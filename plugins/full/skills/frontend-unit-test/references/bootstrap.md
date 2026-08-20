# One-time repo bootstrap (Jest 30 + jsdom + Testing Library)

Run once per repo before the first TDD work. Everything below is copy-adaptable; verify
against the repo's actual webpack/babel setup before applying.

## 1. Packages

```
npm i -D jest@30 jest-environment-jsdom@30 babel-jest@30 \
  @testing-library/react@16 @testing-library/dom@10 \
  @testing-library/jest-dom@6 @testing-library/user-event@14 \
  @types/jest@30
```

(Remove any older `jest`/`babel-jest` majors from devDependencies; `@types/jest` must match
the jest major.)

## 2. Jest config (package.json `"jest"` or jest.config.js)

```json
{
  "testEnvironment": "jsdom",
  "moduleDirectories": ["node_modules", "src"],
  "setupFilesAfterEach": [],
  "setupFilesAfterEnv": ["<rootDir>/src/utils/testing/jest.setup.ts"],
  "moduleNameMapper": {
    "\\.(css|scss|sass)$": "identity-obj-proxy",
    "\\.(svg|png|jpg|woff2?)$": "<rootDir>/src/utils/testing/fileMock.ts"
  },
  "coveragePathIgnorePatterns": ["/node_modules/", "/src/utils/testing/"],
  "testPathIgnorePatterns": ["/node_modules/", "/dist/"]
}
```

Add `identity-obj-proxy` (`npm i -D identity-obj-proxy`) for style imports.
`fileMock.ts`: `module.exports = 'test-file-stub';`

Single-spa repos: webpack externalizes shared modules (e.g. `/^@trimac-da\/.+/`). Jest does
NOT read webpack externals — map them in `moduleNameMapper` to manual mocks under
`src/utils/testing/externals/` (e.g. `"@trimac-da/da-api-module": "<rootDir>/src/utils/testing/externals/daApiModule.ts"`).

## 3. jest.setup.ts

```ts
import '@testing-library/jest-dom';

// jsdom gaps commonly hit by MUI/ag-grid/react-window:
window.matchMedia = window.matchMedia ?? ((query: string) => ({
  matches: false, media: query, onchange: null,
  addListener: () => {}, removeListener: () => {},
  addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
})) as never;
window.ResizeObserver = window.ResizeObserver ?? class { observe() {} unobserve() {} disconnect() {} };
window.IntersectionObserver = window.IntersectionObserver ?? class {
  observe() {} unobserve() {} disconnect() {} takeRecords() { return []; }
} as never;
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
```

## 4. renderWithProviders — the ONLY render helper

`src/utils/testing/renderWithProviders.tsx`:

```tsx
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';
import { CssVarsProvider } from '@mui/joy/styles';
import { ReactElement, ReactNode } from 'react';

import { rootReducer } from 'store/slices'; // adapt to the repo's real store setup
import { theme } from 'core/theme';          // adapt
import { messages } from 'translations';     // adapt: the real catalog

type Options = Omit<RenderOptions, 'wrapper'> & {
  preloadedState?: Partial<ReturnType<typeof rootReducer>>;
  initialEntries?: string[];
};

export const renderWithProviders = (ui: ReactElement, options: Options = {}) => {
  const { preloadedState, initialEntries = ['/'], ...renderOptions } = options;
  const store = configureStore({ reducer: rootReducer, preloadedState });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <Provider store={store}>
      <IntlProvider locale="en" messages={messages}>
        <CssVarsProvider theme={theme}>
          <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
        </CssVarsProvider>
      </IntlProvider>
    </Provider>
  );

  return { store, user: userEvent.setup(), ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
};
```

Rules: fresh store per test; `preloadedState` for scenario setup; the returned `user` is the
user-event instance every interaction goes through; components never get a bespoke wrapper —
extend THIS one if a provider is missing (Shared/Global Change Gate applies: it has every
test as a consumer).

## 5. Coverage ratchet

No `coverageThreshold` at bootstrap. Record the baseline totals (statements/branches/
functions/lines) in the repo (e.g. `docs/coverage-baseline.json` or the CI job) and fail
review when a PR lowers them. Revisit quarterly; introduce a fixed global threshold once the
baseline is respectable.

## 6. dispatch-assist-app specifics (found during bootstrap planning, 2026-08-20)

- jest 27 + @types/jest 30 mismatch — the upgrade fixes it.
- `package.json` carries da-components residue to DELETE while here: `"repository"` pointing
  at da-components, `size-limit` entries for `dist/da-components.*`, and the husky v4-style
  `"husky": { "hooks": ... }` block (husky 7 ignores it; `pre-checkout` isn't a git hook —
  the real graph pull lands in `.husky/post-checkout` in graphify Phase 3).
- Externalized `@trimac-da/da-api-module` (shared ApolloClient/locale/LaunchDarkly) needs a
  manual mock via moduleNameMapper (see §2).
- `BABEL_ENV=test` is already wired in the coverage script; babel.config.json has a test env
  targeting current node — keep.
