# Test patterns (copy-adapt these shapes)

## 1. Mapper / zod schema — table-driven

```ts
import { mapDeskResponse } from './mapper';
import { buildDeskResponse } from './__fixtures__/desk';

describe('mapDeskResponse', () => {
  it.each([
    ['full desk', buildDeskResponse(), { name: 'Desk 1', boardCount: 2 }],
    ['no boards', buildDeskResponse({ boards: [] }), { name: 'Desk 1', boardCount: 0 }],
    ['null description tolerated', buildDeskResponse({ description: null }), expect.objectContaining({ description: '' })],
  ])('%s', (_name, input, expected) => {
    expect(mapDeskResponse(input)).toMatchObject(expected);
  });
});
```

Fixture builder (typed from the request's own types):

```ts
import { DeskResponse } from 'pages/AdminDesks/requests/desks/types';

export const buildDeskResponse = (overrides: Partial<DeskResponse> = {}): DeskResponse => ({
  id: '1', name: 'Desk 1', description: 'd', boards: [{ id: 'b1' }, { id: 'b2' }],
  ...overrides,
});
```

## 2. Hook with the request-module seam

```ts
import { renderHook, waitFor } from '@testing-library/react';

import { useDesks } from './useDesks';
import { buildDeskResponse } from './__fixtures__/desk';

jest.mock('pages/AdminDesks/requests/desks', () => ({
  useDesksQuery: jest.fn(),
}));
import { useDesksQuery } from 'pages/AdminDesks/requests/desks';

it('maps rows and exposes loading', async () => {
  (useDesksQuery as jest.Mock).mockReturnValue({ data: [buildDeskResponse()], loading: false });
  const { result } = renderHook(() => useDesks());
  await waitFor(() => expect(result.current.rows).toHaveLength(1));
});
```

The mock returns the REQUEST MODULE's contract — nothing Apollo- or axios-shaped ever
appears. When the transport migrates, this test does not change.

## 3. Component behavior with renderWithProviders

```tsx
import { screen } from '@testing-library/react';

import { renderWithProviders } from 'utils/testing/renderWithProviders';
import { DeskCard } from '.';
import { buildDesk } from './__fixtures__/desk';

it('opens edit on Edit click', async () => {
  const onEdit = jest.fn();
  const { user } = renderWithProviders(<DeskCard desk={buildDesk()} onEdit={onEdit} />);

  await user.click(screen.getByRole('button', { name: 'Edit' }));

  expect(onEdit).toHaveBeenCalledWith('1');
});
```

Query by role + accessible name. No testids unless there is truly no accessible handle —
and that itself is a finding.

## 4. Formik form — submit-gated errors, two-tier validation

```tsx
it('shows errors only after submit', async () => {
  const { user } = renderWithProviders(<DeskFormModal {...requiredProps} />);

  await user.clear(screen.getByLabelText('Name'));
  expect(screen.queryByText('Name is required')).not.toBeInTheDocument(); // not before submit

  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByText('Name is required')).toBeInTheDocument(); // after
});

it('draft save enforces only the draft tier', async () => {
  const { user } = renderWithProviders(<DeskFormModal {...requiredProps} />);
  await user.click(screen.getByRole('button', { name: 'Save as draft' }));
  expect(screen.queryByText('Criteria must be selected')).not.toBeInTheDocument();
});
```

## 5. Grid wrapper — mock the Table, assert what it receives

```tsx
jest.mock('components/ui/Table', () => ({
  Table: ({ colDefs, rowData }: never) => (
    <div data-columns={colDefs.map((c: { field: string }) => c.field).join(',')}
         data-rows={rowData.length} />
  ),
}));
```

The wrapper's test asserts column ORDER and row mapping through the fake. The colDefs
themselves are exported and unit-tested directly:

```ts
import { COLUMN_DEFS, dayCountFormatter } from './colDefs';

it('keeps the spec column order', () => {
  expect(COLUMN_DEFS.map((c) => c.field)).toEqual(['name', 'businessLine', 'boards', 'actions']);
});

it.each([[0, '0 days'], [1, '1 day'], [5, '5 days']])('formats %s', (input, expected) => {
  expect(dayCountFormatter({ value: input })).toBe(expected);
});
```

## 6. Store slice / selector

```ts
it('stores the grid error', () => {
  const { store } = renderWithProviders(<DesksGrid />, {
    preloadedState: { desksGrid: { error: 'boom' } },
  });
  expect(screen.getByText('boom')).toBeInTheDocument();
});
```

## Anti-patterns (review findings on sight)

- `toMatchSnapshot` anywhere
- `jest.mock('@apollo/client')`, `MockedProvider`, `jest.mock('axios')` — wrong seam
- untyped fixture literals drifting from the Response types
- asserting implementation details (state variable names, internal calls) instead of
  rendered behavior
- weakened assertions after a red test ("expect less so it passes") — the red test was the
  spec; raise a DISCREPANCY instead
- a bespoke provider wrapper in one test file — extend renderWithProviders
