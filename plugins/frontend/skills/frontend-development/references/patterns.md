# Code shapes (copy-adapt; each is the proven canon)

## Component

```tsx
import React from 'react';

type OwnProps = {
  desk: Desk;
  onEdit: (id: string) => void;
};

export const DeskCard: React.FC<OwnProps> = ({ desk, onEdit }) => (
  <Card sx={{ p: 2 }}>
    ...
  </Card>
);
```

Folder: `DeskCard/index.tsx` (+ colocated `hooks/`, `mappers/`, `data/`, `__fixtures__/` as
needed — owner folders attach to this component, not to a grouping folder above it).

## Hooks: state/actions split (RTK)

```ts
// pages/AdminDesks/store/useDesksState.ts — reads only
export const useDesksState = () => useAppSelector(selectDesks);

// pages/AdminDesks/store/useDesksActions.ts — writes only
export const useDesksActions = () => {
  const dispatch = useAppDispatch();
  return useMemo(() => ({
    setFilter: (filter: DeskFilter) => dispatch(desksSlice.actions.setFilter(filter)),
  }), [dispatch]);
};
```

## Request module — axios flavor

```ts
// services/api/index.ts (ONE instance per repo)
const restApi = axios.create({ baseURL: '/api' });
export const setToken = (token?: string): void => {
  restApi.defaults.headers.common.Authorization = `Bearer ${token}`;
};
restApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if ([HTTP_UNAUTHORIZED, HTTP_FORBIDDEN].includes(error.response?.status)) {
      redirectToAuthenticate();
      return;
    }
    return Promise.reject(error.response);
  },
);

// requests/desks/types.ts — FE-owned contract (strict non-null; `?:` not `| null`)
export type DeskResponse = {
  id: string;
  name: string;
  description?: string;
};

// requests/desks/index.ts
export const fetchDesks = (): Promise<DeskResponse[]> =>
  restApi.get('/desks').then((response) => response.data);
```

## Request module — GraphQL flavor

```
requests/desks/
  index.ts   // gql document + useDesksQuery wrapper
  types.ts   // hand-written DesksRequest / DesksResponse (no __generated__)
```

Grid queries: `fetchPolicy: 'network-only'`, `nextFetchPolicy: 'cache-first'`,
`notifyOnNetworkStatusChange: true` — never `no-cache`.

## Form — canonical Formik shape

```tsx
<Formik
  initialValues={initialValues}
  validate={withZodSchema(formSchema)}
  validateOnMount={false}
  enableReinitialize
  onSubmit={(values) => primaryButton?.onSubmit?.(values)}
>
  <DeskFormModalContent ... />
</Formik>
```

Heavy field (final shape — rule 23):

```tsx
// usage
<Field as={CheckboxList} name={formPath.characteristics} options={options} />

// inside CheckboxList
const CheckboxList: React.FC<OwnProps & FieldHookConfig<string[]>> = (props) => {
  const [field, , helpers] = useField<string[]>(props);
  const toggleAll = (checked: boolean): void => {
    helpers.setValue(buildAllValues(checked)); // ONE batch write
  };
  ...
};
```

Two-tier validation (rule 27):

```ts
export const draftSchema = z.object({ name: z.string().min(1), ... });

export const formSchema = z.custom<DeskFormValues>().superRefine((values, ctx) => {
  const draft = draftSchema.safeParse(values);
  draft.error?.issues.forEach((issue) => ctx.addIssue(issue));
  applyCriteriaRules(values, ctx); // full-submit-only rules
});

// draft save (secondary submit): validate draft tier only
const handleSecondary = async (): Promise<void> => {
  const errors = validateWithSchema(draftSchema, values);
  if (isEmpty(errors)) onDraftSave(values);
  else setErrors(errors);
};
```

Submit-gated errors: surface only when `submitCount > 0`; accordion section headers render
an error badge computed from ONLY that section's fields.

## Reference-stable rendered lists (rule 27g)

```tsx
const provinces = useMemo(() => buildProvinceOptions(country), [country]);
...
{provinces.map((province) => (
  <ProvinceCheckbox key={province.code} province={province} /> // ProvinceCheckbox is memo()
))}
```

A new array per render + non-memo children = every child re-renders = the frozen-page bug.

## react-window (rule 22)

`style` goes on the `List`; the outermost DOM element of the row component carries the
injected `style`; providers render INSIDE the list, not around it. The List owns its scroll
container — never wrap it in another scroller.

## Modal width (rule 25)

Shared Modal stays dumb; CONTENT controls width:

```tsx
<Modal close={close}>
  <Box width={550}>...</Box>
</Modal>
```

Never add maxWidth/size props to the shared Modal for one caller.

## Socket.IO (da-planner canon)

One singleton service in `services/websocket/`: `io(url, { transports: ['websocket'],
auth: { token } })`, connect-once promise, `joinRoom`/`leaveRoom` emitting the shared
JOIN_ROOM/LEAVE_ROOM constants, typed `subscribe<T>(event, handler)` returning an
unsubscribe function, payload guarded before the handler runs. Event names are `as const`
constants in ONE file that MIRRORS the backend's socket constants file — never string
literals at emit/on sites, on either side. Components consume through hooks (subscribe in
an effect, unsubscribe in its cleanup), never touch the socket directly.

Ownership split (the rule da-planner BROKE — its global utils/hooks socket layer is the
bad structure we are running from):

- `services/websocket/` owns the TRANSPORT ONLY: connect/disconnect, and the room
  MECHANICS — `joinRoom(room)` / `leaveRoom(room)` live here, nowhere else.
- **Everything page-specific is page-owned**: `pages/<PageName>/hooks/socket/` holds the
  page's socket hook(s) — the ROOM NAME this page joins, WHICH events it listens to, and
  the per-domain handler hooks. Socket usage is never global: the promotion ladder applies
  (da-planner uses sockets on ONE page, so its handlers belong under that page — putting
  them in utils/hooks is exactly how you lose track of where socket.io is used). Only if a
  second page genuinely subscribes to the same events does shared code get promoted, and
  then only the shared part.

Shape inside the page: one `useConnectToSocket` hook — connect on mount, join THIS page's
room via the service, register this page's subscriptions, leave the room + unsubscribe in
the effect cleanup — delegating to per-domain handler hooks (one per event family). Each
handler: typed payload (discriminated by event name) → mapper → store actions. No business
logic in the socket service, no store writes outside handler hooks. In new apps the store
side is RTK actions (da-planner's MobX and `../../../../../` imports are legacy — keep the
handler-hook shape, not those).

## Anti-patterns (instant review findings)

- comment blocks explaining code; `// TODO` without a ticket
- `interface OwnProps`; inline `React.FC<{...}>`; default-export function components
- a third `../` segment; `@/` imports
- new file under `components/{ui,form,common}` without the gate's consumer map + approval
- `FastField`; raw string field names; sequential `setValue` loops
- `useSelector` with inline logic inside JSX; context used as a store
- axios/Apollo imported outside the request seam
- fresh array literal passed to a mapped, memoized child list
