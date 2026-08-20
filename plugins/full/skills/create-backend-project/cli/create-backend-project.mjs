#!/usr/bin/env node
/* Company backend scaffolder — clean-architecture Express/TS service (driver-rest-service canon).
 * Usage: node create-backend-project.mjs               (interactive)
 *        node create-backend-project.mjs my-service --port=3001 --db=mongo --sockets --extras=husky,ci
 * Flags: --db=mongo|none  --redis  --cron  --events  --sockets  --deploy=helm|none  --extras=husky,ci
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.replace(/^--/, '').split('=').concat('true').slice(0, 2)));
let name = args.find((a) => !a.startsWith('--'));

if ('help' in flags || args.includes('-h')) {
  console.log(`Usage: create-backend-project [name] [options]
  --port=<number>        REST port (default 3001)
  --db=mongo|none        Persistence (default none = in-memory repository)
  --redis                Add redis client service
  --cron                 Add cron module (node-cron)
  --events               Add in-process event module (eventemitter3)
  --sockets              Add Socket.IO module (typed constants + zod-validated listeners)
  --deploy=helm|none     Add Dockerfile + helm chart + deploy workflow stub (default none)
  --extras=husky,ci      husky pre-commit; GitHub Actions CI (default husky,ci)`);
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q, d) => ((await rl.question(`${q} [${d}]: `)).trim() || d);
if (!name) name = await ask('Service name', 'my-rest-service');
const port = flags.port || (await ask('REST port', '3001'));
const db = flags.db || (await ask('Database (mongo/none)', 'none'));
const withRedis = 'redis' in flags;
const withCron = 'cron' in flags;
const withEvents = 'events' in flags;
const withSockets = 'sockets' in flags;
const deploy = flags.deploy || 'none';
const extras = (flags.extras ?? 'husky,ci').split(',').map((s) => s.trim()).filter(Boolean);
rl.close();

const root = join(process.cwd(), name);
if (existsSync(root)) { console.error(`${root} already exists`); process.exit(1); }

const deps = {
  express: '^4.21.0', 'http-status': '^1.7.0', zod: '^3.23.8', dotenv: '^16.4.0',
  winston: '^3.14.0', morgan: '^1.10.0', 'morgan-json': '^1.1.0',
  axios: '^1.7.9', 'axios-retry': '^4.5.0',
};
const devDeps = {
  typescript: '^5.6.3', 'ts-node-dev': '^2.0.0', 'tsconfig-paths': '^4.2.0', 'tsc-alias': '^1.8.10',
  '@types/express': '^4.17.21', '@types/node': '^20.12.7', '@types/morgan': '^1.9.9', '@types/morgan-json': '^1.1.0',
  jest: '^29.7.0', 'ts-jest': '^29.2.0', '@types/jest': '^29.5.0', supertest: '^7.0.0', '@types/supertest': '^6.0.2',
  'cross-env': '^7.0.3',
  eslint: '^8.57.0', 'eslint-config-airbnb-base': '^15.0.0', 'eslint-config-prettier': '^8.5.0',
  'eslint-plugin-import': '^2.26.0', 'eslint-plugin-prettier': '^5.0.0', '@typescript-eslint/eslint-plugin': '^6.0.0',
  '@typescript-eslint/parser': '^6.0.0', prettier: '^3.3.0',
};
if (db === 'mongo') Object.assign(deps, { mongoose: '^8.5.0' });
if (withRedis) Object.assign(deps, { redis: '^4.7.0' });
if (withCron) { Object.assign(deps, { 'node-cron': '^3.0.3' }); Object.assign(devDeps, { '@types/node-cron': '^3.0.11' }); }
if (withEvents) Object.assign(deps, { eventemitter3: '^5.0.1' });
if (withSockets) { Object.assign(deps, { 'socket.io': '^4.8.0' }); Object.assign(devDeps, { 'socket.io-client': '^4.8.0' }); }
if (extras.includes('husky')) Object.assign(devDeps, { husky: '^9.1.7' });

const files = {};

files['package.json'] = JSON.stringify({
  name, version: '0.0.0', private: true,
  scripts: {
    dev: `ts-node-dev --respawn --no-notify -r tsconfig-paths/register src/server.ts`,
    build: 'rm -rf build/ && tsc && tsc-alias',
    'start:prod': 'npm run build && cross-env NODE_ENV=production NODE_PATH=./build node build/server.js',
    lint: 'eslint src --ext ts',
    'lint:fix': 'eslint src --ext ts --fix',
    tsc: 'tsc',
    test: 'cross-env NODE_ENV=intTest jest --runInBand --forceExit',
    coverage: 'cross-env NODE_ENV=intTest jest --runInBand --forceExit --coverage',
    ...(extras.includes('husky') ? { prepare: 'husky' } : {}),
  },
  dependencies: Object.fromEntries(Object.entries(deps).sort()),
  devDependencies: Object.fromEntries(Object.entries(devDeps).sort()),
}, null, 2);

files['tsconfig.json'] = JSON.stringify({
  compilerOptions: {
    incremental: true, module: 'commonjs', esModuleInterop: true, allowSyntheticDefaultImports: true,
    target: 'es6', strict: true, moduleResolution: 'node', outDir: 'build', baseUrl: '.',
    paths: { '*': ['src/*'] }, resolveJsonModule: true, skipLibCheck: true,
  },
  include: ['src'], exclude: ['node_modules', 'build'],
}, null, 2);

files['jest.config.js'] = `module.exports = {
    testEnvironment: 'node',
    transform: { '^.+\\\\.(t|j)s$': 'ts-jest' },
    testMatch: ['**/src/**/?(*.)+(spec|test).[jt]s'],
    moduleDirectories: ['node_modules', '<rootDir>/src'],
};
`;

files['.prettierrc'] = JSON.stringify({ tabWidth: 4, singleQuote: true, semi: true, printWidth: 120, trailingComma: 'all', endOfLine: 'auto' }, null, 2);

files['.eslintrc.cjs'] = `module.exports = {
    extends: ['airbnb-base', 'prettier', 'plugin:@typescript-eslint/recommended'],
    parser: '@typescript-eslint/parser',
    plugins: ['prettier', 'import', '@typescript-eslint'],
    env: { node: true, jest: true },
    overrides: [
        {
            files: ['src/**/*.test.ts', 'src/test/**/*.ts'],
            rules: {
                'import/no-extraneous-dependencies': 'off',
                'no-magic-numbers': 'off',
            },
        },
    ],
    rules: {
        'prettier/prettier': ['error', { tabWidth: 4, singleQuote: true, semi: true, printWidth: 120, trailingComma: 'all', endOfLine: 'auto' }],
        indent: ['error', 4, { SwitchCase: 1 }],
        'import/no-unresolved': 'off',
        'import/extensions': 'off',
        'import/prefer-default-export': 'off',
        'no-console': ['error', { allow: ['warn', 'error'] }],
        'no-magic-numbers': ['error', { ignoreArrayIndexes: true, ignore: [-1, 0, 1] }],
        'no-useless-constructor': 'off',
        'no-empty-function': ['error', { allow: ['constructors'] }],
        'class-methods-use-this': 'off',
        'consistent-return': 'off',
        '@typescript-eslint/no-useless-constructor': 'off',
        '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true }],
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'no-unused-vars': 'off',
        'max-classes-per-file': 'off',
        'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
    },
};
`;

files['.env.example'] = `REST_PORT=${port}\n${db === 'mongo' ? 'MONGO_URI=mongodb://localhost:27017/' + name + '\n' : ''}${withRedis ? 'REDIS_URL=redis://localhost:6379\n' : ''}`;
files['.gitignore'] = ['node_modules', 'build', 'coverage', '.env', '.idea', '.vscode', 'graphify-out/'].join('\n') + '\n';

files['src/config/index.ts'] = `import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_PORT = ${port};

const config = {
    env: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.REST_PORT ?? DEFAULT_PORT),${db === 'mongo' ? `\n    mongoUri: process.env.MONGO_URI ?? '',` : ''}${withRedis ? `\n    redisUrl: process.env.REDIS_URL ?? '',` : ''}
};

export default config;
`;

files['src/utils/logger.ts'] = `import winston from 'winston';

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports: [new winston.transports.Console()],
});

export default logger;
`;

files['src/application/statusError/index.ts'] = `export class StatusError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}
`;

files['src/middlewares/middlewareErrors.ts'] = `import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { ZodError } from 'zod';

import { StatusError } from 'application/statusError';

import logger from 'utils/logger';

const respondWithError = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (error instanceof ZodError) {
        const validationErrors = error.errors.map(({ path, message }) => ({ path: path.join('.'), message }));

        res.status(httpStatus.BAD_REQUEST).send({ errors: validationErrors });
        return;
    }

    if (error instanceof StatusError) {
        res.status(error.status).send({ message: error.message });
        return;
    }

    logger.error('unhandled error', { error });
    res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ message: 'Internal server error' });
};

export default respondWithError;
`;

/* -------- example domain slice: note -------- */
files['src/domain/note/types.ts'] = `export type NoteData = {
    id: string;
    title: string;
    body: string;
};
`;

files['src/domain/note/entity.ts'] = `import { NoteData } from 'domain/note/types';

class NoteEntity {
    private readonly id: string;

    private title: string;

    private body: string;

    constructor(data: NoteData) {
        this.id = data.id;
        this.title = data.title;
        this.body = data.body;
    }

    static create(data: NoteData): NoteEntity {
        return new NoteEntity(data);
    }

    getId(): string {
        return this.id;
    }

    getTitle(): string {
        return this.title;
    }

    getBody(): string {
        return this.body;
    }

    rename(title: string): void {
        this.title = title;
    }
}

export default NoteEntity;
`;

files['src/application/requestDto/createNote.request.dto.ts'] = `import { z } from 'zod';

const createNoteRequestDto = z.object({
    title: z.string().min(1),
    body: z.string(),
});

export type CreateNoteRequestDto = z.infer<typeof createNoteRequestDto>;

export const validateCreateNoteRequest = (data: unknown): CreateNoteRequestDto => createNoteRequestDto.parse(data);
`;

files['src/application/requestDto/getNote.request.dto.ts'] = `import { z } from 'zod';

const getNoteRequestDto = z.object({
    id: z.string().min(1),
});

export type GetNoteRequestDto = z.infer<typeof getNoteRequestDto>;

export const validateGetNoteRequest = (data: unknown): GetNoteRequestDto => getNoteRequestDto.parse(data);
`;

files['src/application/dto/note.dto.ts'] = `type NoteDto = {
    id: string;
    title: string;
    body: string;
};

export default NoteDto;
`;

files['src/application/mappers/note/fromEntityToNoteDto.ts'] = `import NoteEntity from 'domain/note/entity';

import NoteDto from 'application/dto/note.dto';

const fromEntityToNoteDto = (entity: NoteEntity): NoteDto => ({
    id: entity.getId(),
    title: entity.getTitle(),
    body: entity.getBody(),
});

export default fromEntityToNoteDto;
`;

const repoImpl = db === 'mongo'
  ? `import httpStatus from 'http-status';
import { Model } from 'mongoose';

import NoteEntity from 'domain/note/entity';

import NoteModel, { NoteDocument } from 'infrastructure/repositories/note/schema';

import { StatusError } from 'application/statusError';

export class NoteRepository {
    private readonly noteModel: Model<NoteDocument> = NoteModel;

    async save(entity: NoteEntity): Promise<NoteEntity> {
        const document = await this.noteModel.create({ title: entity.getTitle(), body: entity.getBody() });

        return NoteEntity.create({ id: String(document._id), title: document.title, body: document.body });
    }

    async getById(id: string): Promise<NoteEntity> {
        const document = await this.noteModel.findById(id);

        if (!document) {
            throw new StatusError('Note not found', httpStatus.NOT_FOUND);
        }

        return NoteEntity.create({ id: String(document._id), title: document.title, body: document.body });
    }
}
`
  : `import httpStatus from 'http-status';
import { randomUUID } from 'crypto';

import NoteEntity from 'domain/note/entity';

import { StatusError } from 'application/statusError';

export class NoteRepository {
    private readonly notes = new Map<string, NoteEntity>();

    save(entity: NoteEntity): Promise<NoteEntity> {
        const saved = NoteEntity.create({ id: randomUUID(), title: entity.getTitle(), body: entity.getBody() });

        this.notes.set(saved.getId(), saved);

        return Promise.resolve(saved);
    }

    getById(id: string): Promise<NoteEntity> {
        const entity = this.notes.get(id);

        if (!entity) {
            throw new StatusError('Note not found', httpStatus.NOT_FOUND);
        }

        return Promise.resolve(entity);
    }
}
`;
files['src/infrastructure/repositories/note/index.ts'] = repoImpl;

if (db === 'mongo') {
  files['src/infrastructure/repositories/note/schema.ts'] = `import { Document, Schema, model } from 'mongoose';

export type NoteDocument = Document & {
    title: string;
    body: string;
};

const noteSchema = new Schema<NoteDocument>({
    title: { type: String, required: true },
    body: { type: String, default: '' },
});

export default model<NoteDocument>('Note', noteSchema);
`;
  files['src/services/connect-db/index.ts'] = `import mongoose from 'mongoose';

import config from 'config';

import logger from 'utils/logger';

const connectDb = async (): Promise<void> => {
    await mongoose.connect(config.mongoUri);
    logger.info('mongo connected');
};

export default connectDb;
`;
}
if (withRedis) {
  files['src/services/connect-redis/index.ts'] = `import { createClient } from 'redis';

import config from 'config';

import logger from 'utils/logger';

export const redisClient = createClient({ url: config.redisUrl });

export const connectRedis = async (): Promise<void> => {
    await redisClient.connect();
    logger.info('redis connected');
};
`;
}

files['src/application/usecases/createNote.usecase.ts'] = `import NoteEntity from 'domain/note/entity';

import { NoteRepository } from 'infrastructure/repositories/note';

import NoteDto from 'application/dto/note.dto';
import fromEntityToNoteDto from 'application/mappers/note/fromEntityToNoteDto';
import { CreateNoteRequestDto } from 'application/requestDto/createNote.request.dto';

export class CreateNote {
    constructor(private noteRepository: NoteRepository) {}

    async run(data: CreateNoteRequestDto): Promise<NoteDto> {
        const entity = NoteEntity.create({ id: '', title: data.title, body: data.body });

        const saved = await this.noteRepository.save(entity);

        return fromEntityToNoteDto(saved);
    }
}
`;

files['src/application/usecases/getNote.usecase.ts'] = `import { NoteRepository } from 'infrastructure/repositories/note';

import NoteDto from 'application/dto/note.dto';
import fromEntityToNoteDto from 'application/mappers/note/fromEntityToNoteDto';
import { GetNoteRequestDto } from 'application/requestDto/getNote.request.dto';

export class GetNote {
    constructor(private noteRepository: NoteRepository) {}

    async run(data: GetNoteRequestDto): Promise<NoteDto> {
        const entity = await this.noteRepository.getById(data.id);

        return fromEntityToNoteDto(entity);
    }
}
`;

files['src/application/usecases/index.ts'] = `import { NoteRepository } from 'infrastructure/repositories/note';

import { CreateNote } from 'application/usecases/createNote.usecase';
import { GetNote } from 'application/usecases/getNote.usecase';

const noteRepository = new NoteRepository();

export const CreateNoteUseCase = new CreateNote(noteRepository);
export const GetNoteUseCase = new GetNote(noteRepository);
`;

files['src/application/controllers/app/livenessCheck.ts'] = `import { Request, Response } from 'express';
import httpStatus from 'http-status';

const livenessCheck = (_req: Request, res: Response): void => {
    res.status(httpStatus.OK).send({ status: 'ok' });
};

export default livenessCheck;
`;

files['src/application/controllers/note/createNote.ts'] = `import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';

import { validateCreateNoteRequest } from 'application/requestDto/createNote.request.dto';
import { CreateNoteUseCase } from 'application/usecases';

const createNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const body = validateCreateNoteRequest(req.body);
        const response = await CreateNoteUseCase.run(body);

        res.status(httpStatus.CREATED).send(response);
    } catch (error) {
        next(error);
    }
};

export default createNote;
`;

files['src/application/controllers/note/getNote.ts'] = `import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';

import { validateGetNoteRequest } from 'application/requestDto/getNote.request.dto';
import { GetNoteUseCase } from 'application/usecases';

const getNote = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const params = validateGetNoteRequest(req.params);
        const response = await GetNoteUseCase.run(params);

        res.status(httpStatus.OK).send(response);
    } catch (error) {
        next(error);
    }
};

export default getNote;
`;

files['src/application/controllers/index.ts'] = `export { default as livenessCheck } from 'application/controllers/app/livenessCheck';
export { default as createNote } from 'application/controllers/note/createNote';
export { default as getNote } from 'application/controllers/note/getNote';
`;

files['src/application/router/index.ts'] = `import { Router } from 'express';

import { createNote, getNote, livenessCheck } from 'application/controllers';

const router = Router();

router.route('/liveness').get(livenessCheck);

router.route('/notes').post(createNote);
router.route('/notes/:id').get(getNote);

export default router;
`;

if (withEvents) {
  files['src/application/modules/event/constants/index.ts'] = `export const NOTE_CREATED = 'NOTE_CREATED' as const;

export type EventName = typeof NOTE_CREATED;
`;
  files['src/application/modules/event/emitter/index.ts'] = `import EventEmitter from 'eventemitter3';

const appEventEmitter = new EventEmitter();

export default appEventEmitter;
`;
}

if (withSockets) {
  files['src/application/modules/socket/constants/index.ts'] = `export const JOIN_ROOM = 'JOIN_ROOM' as const;
export const LEAVE_ROOM = 'LEAVE_ROOM' as const;
export const NOTE_CREATED = 'NOTE_CREATED' as const;

export type InboundEvent = typeof JOIN_ROOM | typeof LEAVE_ROOM;
export type OutboundEvent = typeof NOTE_CREATED;
`;
  files['src/application/modules/socket/index.ts'] = `import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { z } from 'zod';

import { JOIN_ROOM, LEAVE_ROOM } from 'application/modules/socket/constants';

import logger from 'utils/logger';

const roomPayload = z.object({ room: z.string().min(1) });

export const initSocket = (httpServer: HttpServer): Server => {
    const io = new Server(httpServer, { transports: ['websocket'] });

    io.on('connection', (socket) => {
        socket.on(JOIN_ROOM, (data: unknown) => {
            const parsed = roomPayload.safeParse(data);

            if (!parsed.success) {
                logger.warn('invalid JOIN_ROOM payload', { data });
                return;
            }

            socket.join(parsed.data.room);
        });

        socket.on(LEAVE_ROOM, (data: unknown) => {
            const parsed = roomPayload.safeParse(data);

            if (!parsed.success) {
                logger.warn('invalid LEAVE_ROOM payload', { data });
                return;
            }

            socket.leave(parsed.data.room);
        });
    });

    return io;
};
`;
}

if (withCron) {
  files['src/application/services/cron/index.ts'] = `import cron from 'node-cron';

import logger from 'utils/logger';

const EVERY_HOUR = '0 * * * *';

export const startCronJobs = (): void => {
    cron.schedule(EVERY_HOUR, () => {
        logger.info('hourly cron tick — delegate to a usecase, never inline logic here');
    });
};
`;
}

files['src/app.ts'] = `import express from 'express';
import morgan from 'morgan';

import router from 'application/router';

import respondWithError from 'middlewares/middlewareErrors';

const app = express();

app.use(express.json());
app.use(morgan('tiny'));
app.use('/', router);
app.use(respondWithError);

export default app;
`;

const serverBootLines = [];
if (db === 'mongo') serverBootLines.push('    await connectDb();');
if (withRedis) serverBootLines.push('    await connectRedis();');
if (withCron) serverBootLines.push('    startCronJobs();');

files['src/server.ts'] = `import http from 'http';

import app from 'app';
import config from 'config';
${db === 'mongo' ? "import connectDb from 'services/connect-db';\n" : ''}${withRedis ? "import { connectRedis } from 'services/connect-redis';\n" : ''}${withCron ? "import { startCronJobs } from 'application/services/cron';\n" : ''}${withSockets ? "import { initSocket } from 'application/modules/socket';\n" : ''}
import logger from 'utils/logger';

const server = http.createServer(app);
${withSockets ? 'initSocket(server);\n' : ''}
const start = async (): Promise<void> => {
${serverBootLines.join('\n')}
    server.listen(config.port, () => {
        logger.info(\`listening on \${config.port}\`);
    });
};

start().catch((error) => {
    logger.error('failed to start', { error });
    process.exit(1);
});
`;

/* -------- tests (backend-unit-test canon) -------- */
files['src/test/e2e/app.test.ts'] = `import request from 'supertest';

import app from 'app';

describe('liveness', () => {
    it('returns ok', async () => {
        const response = await request(app).get('/liveness');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
    });
});
`;

files['src/test/e2e/notes.test.ts'] = `import request from 'supertest';

import app from 'app';

describe('notes', () => {
    it('creates and reads a note', async () => {
        const created = await request(app).post('/notes').send({ title: 'first', body: 'text' });

        expect(created.status).toBe(201);
        expect(created.body.title).toBe('first');

        const fetched = await request(app).get(\`/notes/\${created.body.id}\`);

        expect(fetched.status).toBe(200);
        expect(fetched.body).toEqual(created.body);
    });

    it('rejects an invalid payload with field errors', async () => {
        const response = await request(app).post('/notes').send({ body: 'no title' });

        expect(response.status).toBe(400);
        expect(response.body.errors[0].path).toBe('title');
    });

    it('404s on a missing note', async () => {
        const response = await request(app).get('/notes/missing-id');

        expect(response.status).toBe(404);
    });
});
`;

files['src/application/usecases/createNote.usecase.test.ts'] = `import NoteEntity from 'domain/note/entity';

import { NoteRepository } from 'infrastructure/repositories/note';

import { CreateNote } from 'application/usecases/createNote.usecase';

describe('CreateNote usecase', () => {
    it('saves via the repository and returns the dto', async () => {
        const saved = NoteEntity.create({ id: '1', title: 't', body: 'b' });
        const repository = { save: jest.fn().mockResolvedValue(saved) } as unknown as NoteRepository;

        const result = await new CreateNote(repository).run({ title: 't', body: 'b' });

        expect(repository.save).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ id: '1', title: 't', body: 'b' });
    });
});
`;

files['src/domain/note/entity.test.ts'] = `import NoteEntity from 'domain/note/entity';

describe('NoteEntity', () => {
    it('renames', () => {
        const entity = NoteEntity.create({ id: '1', title: 'old', body: '' });

        entity.rename('new');

        expect(entity.getTitle()).toBe('new');
    });
});
`;

/* -------- extras -------- */
if (extras.includes('husky')) files['.husky/pre-commit'] = 'npm run lint && npm run tsc\n';
if (extras.includes('ci')) {
  files['.github/workflows/ci.yml'] = `name: ci

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run tsc
      - run: npm test
`;
}
if (deploy === 'helm') {
  files['Dockerfile'] = `FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/build ./build
ENV NODE_ENV=production NODE_PATH=./build
CMD ["node", "build/server.js"]
`;
  files['.helm/app/Chart.yaml'] = `apiVersion: v2\nname: ${name}\nversion: 0.1.0\n`;
  files['.helm/app/values.yaml'] = `replicaCount: 1\nimage:\n  repository: ${name}\n  tag: latest\nservice:\n  port: ${port}\n`;
}

files['README.md'] = `# ${name}

Clean-architecture Express/TypeScript service (company canon: backend-development skill).

## Setup

1. npm ci
2. cp .env.example .env
3. npm run dev

## Verify

npm run lint && npm run tsc && npm test
`;

Object.entries(files).forEach(([relPath, content]) => {
  const full = join(root, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
});

console.log(`
Created ${name}/ — port=${port}, db=${db}, redis=${withRedis}, cron=${withCron}, events=${withEvents}, sockets=${withSockets}, deploy=${deploy}, extras=${extras.join(',') || 'none'}

Next steps:
  cd ${name}
  npm install
  cp .env.example .env
  npm run lint && npm run tsc && npm test
  git init && git add -A
Canon: backend-development skill. Tests-first: backend-unit-test skill.
`);
