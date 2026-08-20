# Backend test shapes (copy-adapt; verified in the create-backend-project scaffold)

## Usecase — mock the repository seam

```ts
describe('CreateNote usecase', () => {
    it('saves via the repository and returns the dto', async () => {
        const saved = NoteEntity.create({ id: '1', title: 't', body: 'b' });
        const repository = { save: jest.fn().mockResolvedValue(saved) } as unknown as NoteRepository;

        const result = await new CreateNote(repository).run({ title: 't', body: 'b' });

        expect(repository.save).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ id: '1', title: 't', body: 'b' });
    });

    it('propagates repository not-found', async () => {
        const repository = {
            getById: jest.fn().mockRejectedValue(new StatusError('Note not found', httpStatus.NOT_FOUND)),
        } as unknown as NoteRepository;

        await expect(new GetNote(repository).run({ id: 'x' })).rejects.toMatchObject({
            status: httpStatus.NOT_FOUND,
        });
    });
});
```

The constructor-injected repository IS the seam — a plain object of `jest.fn()`s typed via
the repository class. No DB, no express, no mongoose in usecase tests.

## Entity — pure, no mocks at all

```ts
describe('NoteEntity', () => {
    it('renames', () => {
        const entity = NoteEntity.create({ id: '1', title: 'old', body: '' });

        entity.rename('new');

        expect(entity.getTitle()).toBe('new');
    });
});
```

Every behavior method and invariant from the architecture record (BR-n) gets a case here —
this is where business rules are PROVEN.

## Mapper & requestDto — table-driven

```ts
it.each([
    ['full document', buildNoteDocument(), { id: '1', title: 't', body: 'b' }],
    ['empty body tolerated', buildNoteDocument({ body: undefined }), expect.objectContaining({ body: '' })],
])('%s', (_name, input, expected) => {
    expect(fromDocumentToEntityDto(input)).toMatchObject(expected);
});

it.each([
    [{ title: 't', body: 'b' }, true],
    [{ body: 'no title' }, false],
    [{ title: '', body: 'empty title' }, false],
])('validates %j → %s', (input, valid) => {
    expect(() => validateCreateNoteRequest(input))[valid ? 'not' : 'toThrow']?.();
    if (valid) expect(validateCreateNoteRequest(input)).toEqual(input);
});
```

Every zod rule the record specifies has a FAILING input proving it.

## e2e — supertest per endpoint (the real route, the real middleware)

```ts
import request from 'supertest';

import app from 'app';

describe('notes', () => {
    it('creates and reads a note', async () => {
        const created = await request(app).post('/notes').send({ title: 'first', body: 'text' });

        expect(created.status).toBe(httpStatus.CREATED);

        const fetched = await request(app).get(`/notes/${created.body.id}`);

        expect(fetched.body).toEqual(created.body);
    });

    it('rejects an invalid payload with field errors', async () => {
        const response = await request(app).post('/notes').send({ body: 'no title' });

        expect(response.status).toBe(httpStatus.BAD_REQUEST);
        expect(response.body.errors[0].path).toBe('title');
    });

    it('404s on a missing note', async () => {
        const response = await request(app).get('/notes/missing-id');

        expect(response.status).toBe(httpStatus.NOT_FOUND);
    });
});
```

Happy path + validation-400 + not-found per endpoint, minimum. DB-backed suites run against
the intTest database, seeded/cleaned per suite, `--runInBand`.

## Socket e2e — real client against the test server

```ts
import { io as clientIo } from 'socket.io-client';

it('joins a room and receives the outbound event', (done) => {
    const client = clientIo(`http://localhost:${port}`, { transports: ['websocket'] });

    client.on('connect', () => {
        client.emit(JOIN_ROOM, { room: 'r1' });
        client.on(NOTE_CREATED, (payload) => {
            expect(payload.id).toBeDefined();
            client.disconnect();
            done();
        });
        triggerNoteCreation('r1');
    });
});
```

Constants imported from `modules/socket/constants` — never string literals in tests.

## Fixture builders

```ts
export const buildNoteDocument = (overrides: Partial<NoteDocument> = {}): NoteDocument =>
    ({ _id: '1', title: 't', body: 'b', ...overrides }) as NoteDocument;
```

Typed from the real document/entity/DTO types, colocated with their tests.

## Anti-patterns (instant review findings)

- mocking mongoose/express internals instead of the repository seam
- mocking a mapper to test a usecase (you own both — test through)
- e2e against the dev database; suites depending on each other's data
- untyped `any` fixtures; assertions loosened to pass (Critical)
- an endpoint with no validation-failure e2e case
