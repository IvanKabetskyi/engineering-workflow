# Backend code shapes (plain code, layer by layer — the driver-rest-service canon)

The dependency table — arrows point INWARD only; a file importing from a layer to its
right is a review finding:

| Layer | may import from | NEVER imports |
|---|---|---|
| domain/ | domain/ only | express, mongoose, axios, zod, redis, socket.io, application/*, infrastructure/* |
| application/requestDto | zod | domain, repositories |
| application/usecases | domain, repositories (interfaces), dto, mappers, requestDto types | express (req/res), mongoose documents |
| application/controllers | requestDto validators, usecases, http-status | repositories, models, mappers, domain |
| application/mappers | domain, dto, repository document types | express |
| infrastructure/repositories | domain entities, own schema, StatusError | controllers, usecases |
| infrastructure/services | axios(+retry), config, own types | domain internals, repositories |

## domain/ — entity class (plain code, zero framework)

```ts
// src/domain/driver/entity.ts
class DriverEntity {
    private readonly id: string;

    private readonly data: Data;

    constructor(id: string, data: Data) {
        this.id = id;
        this.data = data;
    }

    static create(data: DriverType): DriverEntity {
        return new DriverEntity(data.id, data);
    }

    getId(): string {
        return this.id;
    }

    updateGroup(group: string): void {
        this.data.group = group;
    }
}

export default DriverEntity;
```

Private data, `static create`, getters, BEHAVIOR methods. Business invariants live in these
methods — never in usecases, never in controllers. If a usecase contains an `if` about
business state, ask whether it belongs on the entity.

## domain/ — service with a domain-owned Repository contract

```ts
// src/domain/driver/service.ts — the DOMAIN declares the interface it needs
type Repository = {
    updateTagName: (tagId: string, tagName: string) => Promise<void>;
    setDeskIdByTerminal: (deskId: string, terminal: string) => Promise<void>;
    deleteDriversTags: (tagIds: string[]) => Promise<void>;
};

class DriverService {
    constructor(private readonly repository: Repository) {}

    generate(data: Omit<DriverType, 'id'>): DriverEntity {
        const id = newId();

        return DriverEntity.create({ ...data, id: id.toString() });
    }

    updateTagsName(tag: Tag): Promise<void> {
        return this.repository.updateTagName(tag.id, tag.name);
    }
}
```

Dependency inversion, domain-side: infrastructure's repository SATISFIES this structural
type; the domain never imports infrastructure. `types.ts` next to it holds the status
unions and value types every layer shares. **The wiring rule: the repository is injected
into the domain SERVICE; usecases inject the service and every entity operation flows
through it** (`usecase → service → repository`) — a usecase importing a repository
directly is a review finding.

## services/date — the ONLY place the date library lives

```ts
// src/services/date/formats.ts — named format constants, nothing else
export const HOURS_OF_SERVICE = 'hh:mm';

// src/services/date/index.ts — functions wrapping the library (luxon preferred)
import { DateTime } from 'luxon';

export const getOffset = (date?: string): number => {
    if (!date) {
        return 0;
    }

    return DateTime.fromISO(date).offset;
};
```

Every date manipulation is a NAMED function here; callers import the function, never the
library. A `DateTime.`/`format(` outside services/date is a review finding.

## application/requestDto — zod at every input surface

```ts
import { z } from 'zod';

const getDriverRequestDto = z.object({
    employeeId: z.string(),
});

export type GetDriverRequestDto = z.infer<typeof getDriverRequestDto>;

export const validateGetDriverRequest = (data: unknown): GetDriverRequestDto =>
    getDriverRequestDto.parse(data);
```

`data: unknown` in, typed DTO out, `.parse` throws → the error middleware answers 400 with
path+message list. The type comes from `z.infer` — never hand-written twice. Same shape for
HTTP body/params/query, socket payloads, queue/cron inputs.

## application/usecases — one class per operation

```ts
export class GetDriver {
    constructor(private driverRepository: DriverRepository) {}

    async run(data: GetDriverRequestDto): Promise<DriverDto> {
        const driverEntity = await this.driverRepository.getDriverByTmsId(data.employeeId);

        return fromEntityToDriverDto(driverEntity);
    }
}
```

Dependencies via constructor (what unit tests mock), single `run(dto)`, orchestration only:
repository in → entity behavior → mapper out. Instantiated once in `usecases/index.ts` with
real repositories — controllers import the INSTANCE.

## application/controllers — thin, always the same five lines

```ts
const getDriver = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const params = validateGetDriverRequest(req.params);
        const response = await GetDriverUseCase.run(params);

        res.status(httpStatus.OK).send(response);
    } catch (error) {
        next(error);
    }
};
```

validate → run → explicit `httpStatus` constant → `next(error)`. Anything else in a
controller is a finding. `req.body/params/query` NEVER passes a controller unvalidated.

## infrastructure/repositories — the only DB boundary

```ts
export class DriverRepository {
    private readonly driverModel: Model<DriverDocument> = DriverModel;

    async getDriverByTmsId(tmsId: string): Promise<DriverEntity> {
        const document = await this.driverModel.findOne({ tmsId });

        if (!document) {
            throw new StatusError('Driver not found', httpStatus.NOT_FOUND);
        }

        return fromDocumentToEntity(document);
    }
}
```

Owns model + `schema.ts`; converts at the boundary (`fromDocumentToEntity` /
`fromEntityToDocument`); throws `StatusError` for not-found/failed writes. ENTITIES cross
this boundary — documents never leave infrastructure. Every list method's filter has a
matching index (decided in backend-architecture).

## Mappers — one per crossing, named for direction

`fromDocumentToEntity`, `fromEntityToDocument`, `fromEntityToDriverDto` — plain functions,
table-testable. A layer crossing without a mapper (usecase reading `document.field`,
controller reshaping a DTO inline) is a finding.

## StatusError + error middleware — the single error path

```ts
export class StatusError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}
```

Middleware order: ZodError → 400 `{ errors: [{ path, message }] }`; StatusError → its
status; anything else → log with context, 500. `res.status` appears ONLY in controllers and
this middleware. No empty catches; a catch either rethrows, maps to StatusError, or logs
AND handles.

## infrastructure/services — outbound calls

```ts
import axios from 'axios';
import axiosRetry from 'axios-retry';

const hosClient = axios.create({ baseURL: config.hosUrl, timeout: REQUEST_TIMEOUT_MS });
axiosRetry(hosClient, { retries: 3, retryDelay: axiosRetry.exponentialDelay });

export const fetchHosStatus = (driverId: string): Promise<HosStatusResponse> =>
    hosClient.get(`/status/${driverId}`).then((response) => response.data);
```

One client per upstream, timeout + retry ALWAYS, failure behavior per the architecture
record. Usecases depend on the exported functions (mockable seam), never on axios.

## Sockets — a listener is a controller

```ts
socket.on(JOIN_ROOM, (data: unknown) => {
    const parsed = roomPayload.safeParse(data);

    if (!parsed.success) {
        logger.warn('invalid JOIN_ROOM payload', { data });
        return;
    }

    socket.join(parsed.data.room);
});
```

Constants `as const` in `modules/socket/constants` (mirrored by the frontend), zod on every
inbound payload, real work delegated to usecases, emits through a typed wrapper.

## Events & cron — thin triggers, cron ALWAYS lock-guarded

Event names as constants; one listener file per event; listener = validate → usecase.run.

Cron — THE canonical approach (every replica runs the schedule, so the Redis lock is
mandatory; this exact class shape is the reference — one file per job under
`application/services/cron/<job-name>/`):

```ts
import cron from 'node-cron';

const PROCESSING_SYNC_EMPLOYEES_JOB_NAME = 'PROCESSING_SYNC_EMPLOYEES_JOB_NAME';
const PROCESSING_SYNC_EMPLOYEES_JOB_VALUE = '1';
const TTL_IN_SECONDS = 595; // slightly UNDER the */10 cadence — the lock self-expires

export class SyncEmployeesService {
    private cron: typeof cron;

    private task: ReturnType<typeof cron.schedule>;

    constructor(
        private upstreamApiService: UpstreamApiService,
        private appEventEmitter: AppEventEmitter,
        private redisService: RedisService,
    ) {
        this.cron = cron;
        this.task = this.cron.schedule('*/10 * * * *', this.run.bind(this));
    }

    private async isJobProcessing(): Promise<boolean> {
        const value = await this.redisService.getStringValue(PROCESSING_SYNC_EMPLOYEES_JOB_NAME);

        return value === PROCESSING_SYNC_EMPLOYEES_JOB_VALUE;
    }

    private async setJobProcessing(): Promise<void> {
        await this.redisService.setStringExpiredValue(
            PROCESSING_SYNC_EMPLOYEES_JOB_NAME,
            PROCESSING_SYNC_EMPLOYEES_JOB_VALUE,
            TTL_IN_SECONDS,
        );
    }

    private async run(): Promise<void> {
        if (await this.isJobProcessing()) {
            return; // another node holds this tick
        }

        await this.setJobProcessing();

        const employees = await this.upstreamApiService.getEmployees();

        employees.forEach((employee) => {
            this.appEventEmitter.emitEmployeeUpdate({ payload: employee });
        });
    }

    start(): void { this.task.start(); }
    stop(): void { this.task.stop(); }
}
```

Why each piece matters: the LOCK IS TAKEN BEFORE THE WORK (check → set → run, so a slow
run can't double-fire from another node); the TTL is under the cadence so a crashed node's
lock self-expires before the next tick — no manual unlock, no stuck jobs; the job is a
CLASS with injected services (unit-testable at the seam like any usecase) and an explicit
start()/stop() lifecycle; the work itself is delegation — fetch via an infrastructure
service, then EMIT EVENTS per item so listeners/usecases do the real logic. A cron file
containing business logic, or a `cron.schedule` outside a lock-guarded class, is a
Critical review finding.

## Socket.IO multi-node — the Redis adapter

```ts
import { createAdapter } from '@socket.io/redis-adapter';

const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);

const io = new Server(httpServer, { transports: ['websocket'] });
io.adapter(createAdapter(pubClient, subClient));
```

Without the adapter, `io.to(room).emit(...)` reaches only sockets connected to THIS node —
on AWS with 2+ replicas, users on other nodes silently miss events. Mandatory whenever
replicas > 1.

## config & logging

```ts
// src/config/index.ts — the ONLY process.env reader
const config = {
    env: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.REST_PORT ?? DEFAULT_PORT),
    mongoUri: process.env.MONGO_URI ?? '',
};
```

winston logger from `utils/logger`, morgan-json for requests. `console.log` and
`process.env` outside config are findings. Secrets never logged.

## Anti-patterns (instant review findings)

- express/mongoose/axios/zod imported anywhere under `domain/`
- `req.body` (or any unvalidated input) reaching a usecase
- a controller importing a repository, model, or mapper
- a mongoose document escaping infrastructure; `.lean()` results passed around as entities
- business `if`s in usecases that belong on the entity; ANY business logic in controllers,
  socket handlers, or cron jobs
- `res.status` outside controllers/middlewares; swallowed catch blocks on write paths
- string literals at `emit`/`on` sites; outbound axios without timeout+retry
- reshaping a response DTO without flagging the frontend contract impact
