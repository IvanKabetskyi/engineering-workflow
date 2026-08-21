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
const dates = ['luxon', 'date-fns'].includes(flags.dates) ? flags.dates : await ask('Date library (luxon/date-fns, luxon preferred)', 'luxon');
const AUTH_MODES = ['jwt', 'passport', 'none'];
const auth = AUTH_MODES.includes(flags.auth) ? flags.auth : await ask('Auth (jwt = AWS Cognito bearer, the company approach / passport = passport.js / none)', 'jwt');
const PASSPORT_STRATEGIES = ['jwt', 'local', 'google'];
let passportStrategies = [];
if (auth === 'passport') {
  const raw = flags.passport ?? (await ask(`Passport strategies, comma list (${PASSPORT_STRATEGIES.join('/')})`, 'jwt'));
  passportStrategies = raw.split(',').map((s) => s.trim()).filter((s) => PASSPORT_STRATEGIES.includes(s));
  if (!passportStrategies.length) passportStrategies = ['jwt'];
}
const withCron = 'cron' in flags;
const withRedis = 'redis' in flags || withCron; // cron REQUIRES the redis lock (canon)
if (withCron && !('redis' in flags)) console.warn('--cron implies --redis: cron jobs are lock-guarded (canon: no unguarded cron in multi-node deployments)');
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
if (dates === 'luxon') { Object.assign(deps, { luxon: '^3.7.0' }); Object.assign(devDeps, { '@types/luxon': '^3.6.0' }); }
else Object.assign(deps, { 'date-fns': '^4.1.0' });
if (auth === 'jwt') Object.assign(deps, { 'aws-jwt-verify': '^4.0.1' });
if (auth === 'passport') {
  Object.assign(deps, { passport: '^0.7.0' });
  Object.assign(devDeps, { '@types/passport': '^1.0.16' });
  if (passportStrategies.includes('jwt')) { Object.assign(deps, { 'passport-jwt': '^4.0.1' }); Object.assign(devDeps, { '@types/passport-jwt': '^4.0.1' }); }
  if (passportStrategies.includes('local')) { Object.assign(deps, { 'passport-local': '^1.0.0' }); Object.assign(devDeps, { '@types/passport-local': '^1.0.38' }); }
  if (passportStrategies.includes('google')) { Object.assign(deps, { 'passport-google-oauth20': '^2.0.0' }); Object.assign(devDeps, { '@types/passport-google-oauth20': '^2.0.16' }); }
}
if (db === 'mongo') { Object.assign(deps, { mongoose: '^8.5.0' }); Object.assign(devDeps, { 'mongodb-memory-server': '^10.1.0' }); }
if (withRedis) Object.assign(deps, { redis: '^4.7.0' });
if (withCron) { Object.assign(deps, { 'node-cron': '^3.0.3' }); Object.assign(devDeps, { '@types/node-cron': '^3.0.11' }); }
if (withEvents) Object.assign(deps, { eventemitter3: '^5.0.1' });
if (withSockets) { Object.assign(deps, { 'socket.io': '^4.8.0' }); Object.assign(devDeps, { 'socket.io-client': '^4.8.0' }); }
if (withSockets && withRedis) Object.assign(deps, { '@socket.io/redis-adapter': '^8.3.0' });
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
    testTimeout: 30000,${db === 'mongo' ? `
    globalSetup: '<rootDir>/src/test/globalSetup.ts',
    globalTeardown: '<rootDir>/src/test/globalTeardown.ts',
    setupFilesAfterEnv: ['<rootDir>/src/test/afterEnv.ts'],` : ''}
};
`;

if (db === 'mongo') {
  files['src/test/globalSetup.ts'] = `import { MongoMemoryServer } from 'mongodb-memory-server';

/* Boots one in-memory MongoDB for the whole run and publishes its URI to the workers.
 * Set MONGO_URI yourself to run the suite against a real engine instead — this then
 * steps aside entirely. */

// The library default is 10s, which a first launch on macOS (especially Apple Silicon,
// where Gatekeeper verifies the freshly downloaded binary) routinely exceeds.
const LAUNCH_TIMEOUT_MS = 60000;

const globalSetup = async (): Promise<void> => {
    if (process.env.MONGO_URI) {
        return;
    }

    try {
        const mongod = await MongoMemoryServer.create({ instance: { launchTimeout: LAUNCH_TIMEOUT_MS } });

        (globalThis as unknown as { mongod?: MongoMemoryServer }).mongod = mongod;
        process.env.MONGO_URI = mongod.getUri();
    } catch (error) {
        throw new Error(
            [
                'Could not start the in-memory MongoDB used by the test suite.',
                "Re-run with MONGOMS_DEBUG=1 to see mongod's own output.",
                'To bypass it entirely, point the suite at a real engine:',
                '  docker run -d -p 27017:27017 --name ${name}-mongo mongo:7',
                '  MONGO_URI=mongodb://127.0.0.1:27017/${name}-test npm test',
                \`Underlying error: \${error instanceof Error ? error.message : String(error)}\`,
            ].join('\\n'),
        );
    }
};

export default globalSetup;
`;
  files['src/test/afterEnv.ts'] = `import mongoose from 'mongoose';

/* app.ts deliberately does not connect — server.ts owns the lifecycle in production and
 * this file owns it in tests. Without it every repository call buffers until it times out. */
beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI ?? '');
});

afterEach(async () => {
    const { collections } = mongoose.connection;

    await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});
`;
  files['src/test/globalTeardown.ts'] = `import { MongoMemoryServer } from 'mongodb-memory-server';

const globalTeardown = async (): Promise<void> => {
    const { mongod } = globalThis as unknown as { mongod?: MongoMemoryServer };

    await mongod?.stop();
};

export default globalTeardown;
`;
}

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
        'no-underscore-dangle': 0,
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

files['.env.example'] = `REST_PORT=${port}\n${db === 'mongo' ? 'MONGO_URI=mongodb://localhost:27017/' + name + '\n' : ''}${withRedis ? 'REDIS_URL=redis://localhost:6379\n' : ''}${auth === 'jwt' ? 'AUTH_AWS_REGION=us-west-2\nAUTH_USER_POOL=\nAUTH_CLIENT_ID=\n' : ''}${auth === 'passport' && passportStrategies.includes('jwt') ? 'JWT_SECRET=change-me\n' : ''}${auth === 'passport' && passportStrategies.includes('google') ? 'GOOGLE_CLIENT_ID=\nGOOGLE_CLIENT_SECRET=\nGOOGLE_CALLBACK_URL=\n' : ''}`;
files['.gitignore'] = ['node_modules', 'build', 'coverage', '.env', '.idea', '.vscode', 'graphify-out/'].join('\n') + '\n';

// graphify: repo code-graph MCP (windows: py; mac/linux: swap command to python3).
// Serves graphify-out/graph.json — run `graphify extract . --code-only` first (graphify skill).
files['.mcp.json'] = JSON.stringify({
  mcpServers: { graphify: { command: 'py', args: ['-m', 'graphify.serve', 'graphify-out/graph.json'] } },
}, null, 2);

const authConfig = auth === 'jwt'
  ? `
    auth: {
        region: process.env.AUTH_AWS_REGION ?? '',
        userPool: process.env.AUTH_USER_POOL ?? '',
        clientId: process.env.AUTH_CLIENT_ID ?? '',
    },`
  : auth === 'passport'
    ? `
    auth: {${passportStrategies.includes('jwt') ? `\n        jwtSecret: process.env.JWT_SECRET ?? '',` : ''}${passportStrategies.includes('google') ? `
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID ?? '',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
            callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? '',
        },` : ''}
    },`
    : '';

files['src/config/index.ts'] = `import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_PORT = ${port};

const config = {
    env: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.REST_PORT ?? DEFAULT_PORT),${db === 'mongo' ? `\n    mongoUri: process.env.MONGO_URI ?? '',` : ''}${withRedis ? `\n    redisUrl: process.env.REDIS_URL ?? '',` : ''}${authConfig}
};

export default config;
`;

files['src/services/date/formats.ts'] = `export const ISO_DATE = 'yyyy-MM-dd';\n`;
files['src/services/date/index.ts'] = dates === 'luxon'
  ? `import { DateTime } from 'luxon';

export const getOffset = (date?: string): number => {
    if (!date) {
        return 0;
    }

    return DateTime.fromISO(date).offset;
};

export const nowIso = (): string => DateTime.now().toISO();
`
  : `import { formatISO, parseISO } from 'date-fns';

export const nowIso = (): string => formatISO(new Date());

export const parseIso = (date: string): Date => parseISO(date);
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

if (auth === 'jwt') {
  files['src/middlewares/auth.ts'] = `import { NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

import config from 'config';

import { StatusError } from 'application/statusError';

/* Lazy: creating the verifier validates the pool id, so it must not run at import time —
 * tests and tooling import app without auth env configured. */
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

const getVerifier = (): ReturnType<typeof CognitoJwtVerifier.create> => {
    if (!verifier) {
        verifier = CognitoJwtVerifier.create({
            userPoolId: config.auth.userPool,
            clientId: config.auth.clientId,
            tokenUse: 'access',
        });
    }

    return verifier;
};

const BEARER_PREFIX = 'Bearer ';

const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
        const header = req.headers.authorization ?? '';

        if (!header.startsWith(BEARER_PREFIX)) {
            throw new StatusError('Missing bearer token', httpStatus.UNAUTHORIZED);
        }

        const payload = await getVerifier().verify(header.slice(BEARER_PREFIX.length));

        (req as Request & { user?: unknown }).user = payload;

        next();
    } catch (error) {
        next(error instanceof StatusError ? error : new StatusError('Invalid token', httpStatus.UNAUTHORIZED));
    }
};

export default authenticate;
`;
}

if (auth === 'passport') {
  const strategyImports = [
    passportStrategies.includes('jwt') ? "import { ExtractJwt, Strategy as JwtStrategy } from 'passport-jwt';" : '',
    passportStrategies.includes('local') ? "import { Strategy as LocalStrategy } from 'passport-local';" : '',
    passportStrategies.includes('google') ? "import { Strategy as GoogleStrategy } from 'passport-google-oauth20';" : '',
  ].filter(Boolean).join('\n');
  const strategyRegistrations = [
    passportStrategies.includes('jwt') ? `/* The 'unset' fallback keeps registration valid without env; the verify callback
 * refuses everything until JWT_SECRET is actually configured. */
passport.use(
    new JwtStrategy(
        { jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: config.auth.jwtSecret || 'unset' },
        (payload, done) => (config.auth.jwtSecret ? done(null, payload) : done(null, false)),
    ),
);` : '',
    passportStrategies.includes('local') ? `/* The verify callback MUST delegate to a usecase that checks real credentials —
 * this scaffold accepts nothing until you implement it. */
passport.use(
    new LocalStrategy((_username, _password, done) => {
        done(new StatusError('Local strategy verify not implemented', httpStatus.NOT_IMPLEMENTED));
    }),
);` : '',
    passportStrategies.includes('google') ? `/* Registered only when configured — OAuth2Strategy refuses empty client ids. */
if (config.auth.google.clientId) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: config.auth.google.clientId,
                clientSecret: config.auth.google.clientSecret,
                callbackURL: config.auth.google.callbackUrl,
            },
            (_accessToken, _refreshToken, profile, done) => done(null, profile),
        ),
    );
}` : '',
  ].filter(Boolean).join('\n\n');
  files['src/middlewares/auth.ts'] = `import passport from 'passport';
${passportStrategies.includes('local') ? "import httpStatus from 'http-status';\n" : ''}${strategyImports}

import config from 'config';
${passportStrategies.includes('local') ? "\nimport { StatusError } from 'application/statusError';\n" : ''}
${strategyRegistrations}

export const initAuth = passport.initialize();

export const authenticate = passport.authenticate('${passportStrategies.includes('jwt') ? 'jwt' : passportStrategies[0]}', { session: false });
`;
}

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

files['src/domain/note/service.ts'] = `${db === 'mongo' ? `import { Types } from 'mongoose';

` : `import { randomUUID } from 'crypto';

`}import NoteEntity from 'domain/note/entity';
import { NoteData } from 'domain/note/types';

/* The domain declares the Repository contract it needs; infrastructure satisfies it
 * structurally. The repository is injected HERE — every entity operation flows through
 * this service (usecases depend on the service, never on the repository directly). */
type Repository = {
    save: (entity: NoteEntity) => Promise<NoteEntity>;
    getById: (id: string) => Promise<NoteEntity>;
};

class NoteService {
    constructor(private readonly repository: Repository) {}

    generate(data: Omit<NoteData, 'id'>): NoteEntity {
        return NoteEntity.create({ ...data, id: ${db === 'mongo' ? 'new Types.ObjectId().toString()' : 'randomUUID()'} });
    }

    saveNote(entity: NoteEntity): Promise<NoteEntity> {
        return this.repository.save(entity);
    }

    getNoteById(id: string): Promise<NoteEntity> {
        return this.repository.getById(id);
    }
}

export default NoteService;
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
        const document = await this.noteModel.create({
            _id: entity.getId(),
            title: entity.getTitle(),
            body: entity.getBody(),
        });

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

import NoteEntity from 'domain/note/entity';

import { StatusError } from 'application/statusError';

export class NoteRepository {
    private readonly notes = new Map<string, NoteEntity>();

    save(entity: NoteEntity): Promise<NoteEntity> {
        this.notes.set(entity.getId(), entity);

        return Promise.resolve(entity);
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
  files['src/infrastructure/services/redis/index.ts'] = `import { redisClient } from 'services/connect-redis';

const APP_REDIS_KEY_PREFIX = '${name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}';

export class RedisService {
    private getAppKey(key: string): string {
        return \`\${APP_REDIS_KEY_PREFIX}:\${key}\`;
    }

    async getStringValue(key: string): Promise<string | null> {
        return redisClient.get(this.getAppKey(key));
    }

    async setStringExpiredValue(key: string, value: string, expirationTime: number): Promise<void> {
        await redisClient.setEx(this.getAppKey(key), expirationTime, value);
    }
}
`;
}

files['src/application/usecases/createNote.usecase.ts'] = `import NoteService from 'domain/note/service';

import NoteDto from 'application/dto/note.dto';
import fromEntityToNoteDto from 'application/mappers/note/fromEntityToNoteDto';
import { CreateNoteRequestDto } from 'application/requestDto/createNote.request.dto';

export class CreateNote {
    constructor(private noteService: NoteService) {}

    async run(data: CreateNoteRequestDto): Promise<NoteDto> {
        const entity = this.noteService.generate({ title: data.title, body: data.body });

        const saved = await this.noteService.saveNote(entity);

        return fromEntityToNoteDto(saved);
    }
}
`;

files['src/application/usecases/getNote.usecase.ts'] = `import NoteService from 'domain/note/service';

import NoteDto from 'application/dto/note.dto';
import fromEntityToNoteDto from 'application/mappers/note/fromEntityToNoteDto';
import { GetNoteRequestDto } from 'application/requestDto/getNote.request.dto';

export class GetNote {
    constructor(private noteService: NoteService) {}

    async run(data: GetNoteRequestDto): Promise<NoteDto> {
        const entity = await this.noteService.getNoteById(data.id);

        return fromEntityToNoteDto(entity);
    }
}
`;

files['src/application/usecases/index.ts'] = `import NoteService from 'domain/note/service';

import { NoteRepository } from 'infrastructure/repositories/note';

import { CreateNote } from 'application/usecases/createNote.usecase';
import { GetNote } from 'application/usecases/getNote.usecase';

const noteService = new NoteService(new NoteRepository());

export const CreateNoteUseCase = new CreateNote(noteService);
export const GetNoteUseCase = new GetNote(noteService);
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

${auth === 'jwt' ? "import authenticate from 'middlewares/auth';\n\n" : ''}${auth === 'passport' ? "import { authenticate } from 'middlewares/auth';\n\n" : ''}import { createNote, getNote, livenessCheck } from 'application/controllers';

const router = Router();

router.route('/liveness').get(livenessCheck);
${auth !== 'none' ? `
/* Which routes require auth is decided in backend-architecture's route table —
 * this demo route proves the middleware end-to-end (no token → 401). */
router.route('/protected/liveness').get(authenticate, livenessCheck);
` : ''}
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
${withRedis ? "import { createAdapter } from '@socket.io/redis-adapter';\n" : ''}import { z } from 'zod';
${withRedis ? "\nimport { redisClient } from 'services/connect-redis';\n" : ''}
import { JOIN_ROOM, LEAVE_ROOM } from 'application/modules/socket/constants';

import logger from 'utils/logger';

const roomPayload = z.object({ room: z.string().min(1) });

export const initSocket = ${withRedis ? 'async ' : ''}(httpServer: HttpServer): ${withRedis ? 'Promise<Server>' : 'Server'} => {
    const io = new Server(httpServer, { transports: ['websocket'] });
${withRedis ? `
    const pubClient = redisClient.duplicate();
    const subClient = redisClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));` : ''}

    io.on('connection', (socket) => {
        socket.on(JOIN_ROOM, (data: unknown) => {
            try {
                socket.join(roomPayload.parse(data).room);
            } catch (_error) {
                logger.warn('invalid JOIN_ROOM payload', { data });
            }
        });

        socket.on(LEAVE_ROOM, (data: unknown) => {
            try {
                socket.leave(roomPayload.parse(data).room);
            } catch (_error) {
                logger.warn('invalid LEAVE_ROOM payload', { data });
            }
        });
    });

    return io;
};
`;
}

if (withCron) {
  files['src/application/services/cron/example-job/index.ts'] = `import cron from 'node-cron';

import { RedisService } from 'infrastructure/services/redis';

import logger from 'utils/logger';

const JOB_NAME = 'EXAMPLE_HOURLY_JOB';
const JOB_VALUE = '1';
const EVERY_HOUR = '0 * * * *';
const LOCK_TTL_IN_SECONDS = 3540;

export class ExampleJobService {
    private task = cron.schedule(EVERY_HOUR, this.run.bind(this), { scheduled: false });

    constructor(private redisService: RedisService) {}

    private async isJobProcessing(): Promise<boolean> {
        return (await this.redisService.getStringValue(JOB_NAME)) === JOB_VALUE;
    }

    private async setJobProcessing(): Promise<void> {
        await this.redisService.setStringExpiredValue(JOB_NAME, JOB_VALUE, LOCK_TTL_IN_SECONDS);
    }

    private async run(): Promise<void> {
        if (await this.isJobProcessing()) {
            return;
        }

        await this.setJobProcessing();

        logger.info('example job tick — delegate to a usecase, never inline logic here');
    }

    start(): void {
        this.task.start();
    }

    stop(): void {
        this.task.stop();
    }
}
`;
  files['src/application/services/cron/index.ts'] = `import { RedisService } from 'infrastructure/services/redis';

import { ExampleJobService } from 'application/services/cron/example-job';

const exampleJob = new ExampleJobService(new RedisService());

export const startCronJobs = (): void => {
    exampleJob.start();
};
`;
}

files['src/app.ts'] = `import express from 'express';
import morgan from 'morgan';

import router from 'application/router';

${auth === 'passport' ? "import { initAuth } from 'middlewares/auth';\n" : ''}import respondWithError from 'middlewares/middlewareErrors';

const app = express();

app.use(express.json());
app.use(morgan('tiny'));
${auth === 'passport' ? 'app.use(initAuth);\n' : ''}app.use('/', router);
app.use(respondWithError);

export default app;
`;

const serverBootLines = [];
if (db === 'mongo') serverBootLines.push('    await connectDb();');
if (withRedis) serverBootLines.push('    await connectRedis();');
if (withSockets && withRedis) serverBootLines.push('    await initSocket(server);');
if (withCron) serverBootLines.push('    startCronJobs();');

files['src/server.ts'] = `import http from 'http';

import app from 'app';
import config from 'config';
${db === 'mongo' ? "import connectDb from 'services/connect-db';\n" : ''}${withRedis ? "import { connectRedis } from 'services/connect-redis';\n" : ''}${withCron ? "import { startCronJobs } from 'application/services/cron';\n" : ''}${withSockets ? "import { initSocket } from 'application/modules/socket';\n" : ''}
import logger from 'utils/logger';

const server = http.createServer(app);
${withSockets && !withRedis ? 'initSocket(server);\n' : ''}
const start = async (): Promise<void> => {
${serverBootLines.length ? `${serverBootLines.join('\n')}\n` : ''}    server.listen(config.port, () => {
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
${auth !== 'none' ? `
describe('auth', () => {
    it('rejects the protected route without a token', async () => {
        const response = await request(app).get('/protected/liveness');

        expect(response.status).toBe(401);
    });
});
` : ''}`;

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
import NoteService from 'domain/note/service';

import { CreateNote } from 'application/usecases/createNote.usecase';

describe('CreateNote usecase', () => {
    it('generates and saves through the domain service, returns the dto', async () => {
        const saved = NoteEntity.create({ id: '1', title: 't', body: 'b' });
        const save = jest.fn().mockResolvedValue(saved);
        const getById = jest.fn();
        const noteService = new NoteService({ save, getById });

        const result = await new CreateNote(noteService).run({ title: 't', body: 'b' });

        expect(save).toHaveBeenCalledTimes(1);
        expect(save.mock.calls[0][0].getId()).toBeTruthy();
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

## Code graph (graphify)

\`.mcp.json\` registers the graphify MCP (windows \`py\`; on mac/linux change the command
to \`python3\`). Install with the MCP extra — \`pip install "graphifyy[mcp]"\` (python
3.10+; plain graphifyy lacks the server) — build the graph once with
\`graphify extract . --code-only\`, then the workflow commands query it
(\`graphify-out/\` stays gitignored).
`;

Object.entries(files).forEach(([relPath, content]) => {
  const full = join(root, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
});

console.log(`
Created ${name}/ — port=${port}, db=${db}, dates=${dates}, redis=${withRedis}, cron=${withCron}, events=${withEvents}, sockets=${withSockets}, deploy=${deploy}, extras=${extras.join(',') || 'none'}

Next steps:
  cd ${name}
  npm install
  cp .env.example .env
  npm run lint && npm run tsc && npm test
  git init && git add -A
  graphify extract . --code-only   # builds graphify-out/graph.json; .mcp.json already registers the MCP (mac/linux: edit command py -> python3)
Canon: backend-development skill. Tests-first: backend-unit-test skill.
`);
