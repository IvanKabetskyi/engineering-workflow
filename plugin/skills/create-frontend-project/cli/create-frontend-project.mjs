#!/usr/bin/env node
/* Company frontend scaffolder.
 * Usage: node create-frontend-project.mjs            (interactive)
 *        node create-frontend-project.mjs my-app --ui=joy --data=axios --port=3000 --extras=husky,ci,intl
 * Canon: frontend-development skill. Testing: frontend-unit-test skill (Vitest flavor).
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

const UI_LIBS = ['joy', 'material', 'antd'];
const DATA_LAYERS = ['axios', 'graphql'];
const EXTRAS = ['husky', 'ci', 'intl', 'sockets'];

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => a.replace(/^--/, '').split('=')));
let name = args.find((a) => !a.startsWith('--'));

if ('help' in flags || args.includes('-h')) {
  console.log(`Usage: create-frontend-project [name] [options]

Options:
  --ui=joy|material|antd     UI library (default: joy)
  --data=axios|graphql       Data layer (default: axios)
  --port=<number>            Dev server port (default: 3000)
  --extras=husky,ci,intl     Comma list; any of: husky, ci, intl (default: husky,ci)
  --help, -h                 Show this help

Without arguments the CLI asks interactively.`);
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (question, fallback) => ((await rl.question(`${question} [${fallback}]: `)).trim() || fallback);

if (!name) name = await ask('Project name', 'my-frontend-app');
const ui = UI_LIBS.includes(flags.ui) ? flags.ui : await ask(`UI library (${UI_LIBS.join('/')})`, 'joy');
const data = DATA_LAYERS.includes(flags.data) ? flags.data : await ask(`Data layer (${DATA_LAYERS.join('/')})`, 'axios');
const port = flags.port || (await ask('Dev port', '3000'));
const dates = ['luxon', 'date-fns'].includes(flags.dates) ? flags.dates : await ask('Date library (luxon/date-fns, luxon preferred)', 'luxon');
const extras = (flags.extras ?? (await ask(`Extras (${EXTRAS.join(',')} or none)`, 'husky,ci')))
  .split(',').map((s) => s.trim()).filter((s) => EXTRAS.includes(s));
rl.close();

if (!UI_LIBS.includes(ui) || !DATA_LAYERS.includes(data)) {
  console.error(`ui must be one of ${UI_LIBS}, data one of ${DATA_LAYERS}`);
  process.exit(1);
}
const root = join(process.cwd(), name);
if (existsSync(root)) {
  console.error(`${root} already exists`);
  process.exit(1);
}

/* ---------------- dependency matrix ---------------- */
const deps = {
  react: '^19.0.0', 'react-dom': '^19.0.0',
  '@reduxjs/toolkit': '^2.3.0', 'react-redux': '^9.1.2',
  '@tanstack/react-query': '^5.59.0',
  'react-router-dom': '^6.28.0',
  formik: '^2.4.6', 'formik-validator-zod': '^2.0.1', zod: '^3.23.8',
  'react-use': '^17.4.0',
};
const devDeps = {
  '@vitejs/plugin-react-swc': '^3.7.0', vite: '^6.0.0', 'vite-plugin-checker': '^0.8.0',
  typescript: '^5.6.3', '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0', '@types/node': '^20.12.7',
  vitest: '^3.0.0', jsdom: '^25.0.0',
  '@testing-library/react': '^16.0.0', '@testing-library/dom': '^10.0.0',
  '@testing-library/jest-dom': '^6.5.0', '@testing-library/user-event': '^14.5.0',
  eslint: '^8.57.0', 'eslint-config-airbnb': '^19.0.4', 'eslint-config-prettier': '^8.5.0',
  'eslint-plugin-import': '^2.26.0', 'eslint-plugin-jsx-a11y': '^6.6.1', 'eslint-plugin-prettier': '^5.0.0',
  'eslint-plugin-react': '^7.30.1', 'eslint-plugin-react-hooks': '^4.6.0', 'eslint-plugin-react-refresh': '^0.4.3',
  '@typescript-eslint/eslint-plugin': '^6.0.0', '@typescript-eslint/parser': '^6.0.0',
  prettier: '^3.3.0', sass: '^1.79.4', dotenv: '^16.0.3',
};
if (ui === 'joy') Object.assign(deps, { '@mui/joy': '^5.0.0-beta.52', '@emotion/react': '^11.11.4', '@emotion/styled': '^11.11.0', '@fontsource/inter': '^5.0.17' });
if (ui === 'material') Object.assign(deps, { '@mui/material': '^9.0.0', '@emotion/react': '^11.11.4', '@emotion/styled': '^11.11.0', '@mui/icons-material': '^9.0.0', '@fontsource/roboto': '^5.0.12' });
if (ui === 'antd') Object.assign(deps, { antd: '^6.0.0' });
if (dates === 'luxon') Object.assign(deps, { luxon: '^3.7.0' }), Object.assign(devDeps, { '@types/luxon': '^3.6.0' });
else Object.assign(deps, { 'date-fns': '^4.1.0' });
if (data === 'axios') Object.assign(deps, { axios: '^1.7.0' });
if (data === 'graphql') Object.assign(deps, { '@apollo/client': '^3.11.0', graphql: '^16.9.0' });
if (extras.includes('intl')) Object.assign(deps, { 'react-intl': '^10.0.0' });
if (extras.includes('sockets')) Object.assign(deps, { 'socket.io-client': '^4.8.0' });
if (extras.includes('husky')) Object.assign(devDeps, { husky: '^9.1.0', 'lint-staged': '^15.2.0' });

/* ---------------- files ---------------- */
const files = {};

files['package.json'] = JSON.stringify({
  name, private: true, version: '0.0.0', type: 'module',
  scripts: {
    dev: 'vite --open',
    build: 'tsc && vite build',
    preview: 'vite preview',
    lint: 'eslint src --ext ts,tsx',
    'lint:fix': 'eslint src --ext ts,tsx --fix',
    tsc: 'tsc',
    test: 'vitest run',
    'test:watch': 'vitest',
    coverage: 'vitest run --coverage',
    ...(extras.includes('husky') ? { prepare: 'husky' } : {}),
  },
  ...(extras.includes('husky') ? { 'lint-staged': { '*.{ts,tsx}': ['eslint --fix', 'bash -c tsc'] } } : {}),
  dependencies: Object.fromEntries(Object.entries(deps).sort()),
  devDependencies: Object.fromEntries(Object.entries(devDeps).sort()),
}, null, 2);

files['index.html'] = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const ALIASES = ['assets', 'core', 'store', 'pages', 'components', 'constants', 'hooks', 'routing', 'translations', 'utils', 'mappers', 'types', 'requests', 'services', 'icons'];

files['vite.config.ts'] = `/// <reference types="vitest/config" />
import * as path from 'path';

import 'dotenv/config';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import pluginChecker from 'vite-plugin-checker';

export default defineConfig({
  plugins: [react(), pluginChecker({ typescript: true })],
  server: {
    port: ${port},
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
${ALIASES.map((a) => `      ${a}: path.resolve(__dirname, './src/${a}'),`).join('\n')}
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/utils/testing/vitest.setup.ts'],
    coverage: { provider: 'v8', reportsDirectory: 'coverage' },
  },
});
`;

files['tsconfig.json'] = JSON.stringify({
  compilerOptions: {
    downlevelIteration: true, sourceMap: false, baseUrl: 'src', target: 'es6',
    lib: ['dom', 'dom.iterable', 'esnext'], allowJs: false, checkJs: false, skipLibCheck: true,
    esModuleInterop: true, allowSyntheticDefaultImports: true, strict: true,
    forceConsistentCasingInFileNames: true, module: 'esnext', moduleResolution: 'bundler',
    resolveJsonModule: true, isolatedModules: true, noEmit: true, jsx: 'react-jsx',
    noFallthroughCasesInSwitch: true, types: ['vitest/globals', '@testing-library/jest-dom'],
  },
  include: ['src'],
}, null, 2);

files['tsconfig.node.json'] = JSON.stringify({
  compilerOptions: { composite: true, module: 'ESNext', moduleResolution: 'Bundler', allowSyntheticDefaultImports: true },
  include: ['vite.config.ts'],
}, null, 2);

files['.prettierrc'] = JSON.stringify({ trailingComma: 'all', tabWidth: 2, semi: true, singleQuote: true, printWidth: 120, endOfLine: 'auto' }, null, 2);

files['.env.example'] = 'BACKEND_URL=http://localhost:8080\n';

const uiMcp = ui === 'antd'
  ? { antd: { command: 'npx', args: ['-y', '@ant-design/cli', 'mcp'] } }
  : { 'mui-mcp': { command: 'npx', args: ['-y', '@mui/mcp@latest'] } };
// graphify: repo code-graph MCP (windows: py; mac/linux: swap command to python3).
// Serves graphify-out/graph.json — run `graphify extract . --code-only` first (graphify skill).
const graphifyMcp = { graphify: { command: 'py', args: ['-m', 'graphify.serve', 'graphify-out/graph.json'] } };
files['.mcp.json'] = JSON.stringify({ mcpServers: { ...uiMcp, ...graphifyMcp } }, null, 2);
// Team plugin distribution: whoever trusts this repo in Claude Code gets the marketplace + role plugin automatically.
files['.claude/settings.json'] = JSON.stringify({
  extraKnownMarketplaces: { millwright: { source: { source: 'github', repo: 'millwright-tools/engineering-workflow' } } },
  enabledPlugins: { 'engineering-workflow-frontend@millwright': true },
}, null, 2);
files['.gitignore'] = ['node_modules', 'dist', 'coverage', '.env', '.idea', '.vscode', 'graphify-out/'].join('\n') + '\n';

/* eslint: the dispatch-assist canon config, path groups matching the scaffolded structure */
const PATH_GROUPS = [...ALIASES, '../../**', '../**', './**'];
files['.eslintrc.cjs'] = `module.exports = {
  extends: ['airbnb', 'prettier', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  plugins: ['prettier', 'import', 'react', 'react-hooks', '@typescript-eslint'],
  rules: {
    'react/function-component-definition': [
      'error',
      { namedComponents: ['function-declaration', 'function-expression', 'arrow-function'], unnamedComponents: 'function-expression' },
    ],
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/explicit-function-return-type': ['warn', { allowExpressions: true, allowHigherOrderFunctions: true }],
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-use-before-define': ['error'],
    'arrow-parens': 0,
    'arrow-body-style': 0,
    'no-unused-vars': ['error', { destructuredArrayIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_', args: 'none' }],
    '@typescript-eslint/no-unused-vars': ['error', { destructuredArrayIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_', args: 'none' }],
    'import/no-extraneous-dependencies': 'off',
    'import/no-unresolved': 'off',
    'import/extensions': 'off',
    'import/prefer-default-export': 'off',
    'import/no-named-as-default': 'off',
    'import/no-cycle': 'off',
    'import/order': [
      'error',
      {
        'newlines-between': 'always',
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        pathGroups: [
${PATH_GROUPS.map((p) => `          { pattern: '${p.includes('.') ? p : `${p}/**`}', group: 'internal', position: 'before' },`).join('\n')}
        ],
        pathGroupsExcludedImportTypes: ['internal'],
      },
    ],
    'no-use-before-define': 'off',
    'no-undef': 'off',
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
    'no-param-reassign': 0,
    'no-magic-numbers': ['error', { ignoreArrayIndexes: true, ignore: [-1, 0, 1] }],
    'no-implicit-coercion': ['error', { boolean: true, number: true, string: true }],
    'no-return-assign': 'error',
    'no-self-compare': 'error',
    'no-async-promise-executor': 'error',
    'require-await': 'error',
    'consistent-return': 0,
    'react/prop-types': 0,
    'react/destructuring-assignment': 0,
    'react/require-default-props': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react/jsx-filename-extension': [1, { extensions: ['.tsx'] }],
    'react/jsx-props-no-spreading': 0,
    'jsx-a11y/label-has-associated-control': 0,
    'prettier/prettier': [
      'error',
      { trailingComma: 'all', tabWidth: 2, semi: true, singleQuote: true, printWidth: 120, endOfLine: 'auto' },
    ],
  },
};
`;

/* ---------------- src skeleton ---------------- */
const themeByUi = {
  joy: `import { extendTheme } from '@mui/joy/styles';

export const theme = extendTheme({
  colorSchemes: {
    light: {
      palette: {},
    },
  },
});
`,
  material: `import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {},
});
`,
  antd: `import type { ThemeConfig } from 'antd';

export const theme: ThemeConfig = {
  token: {},
};
`,
};

const providerByUi = {
  joy: { imp: "import { CssVarsProvider } from '@mui/joy/styles';\nimport CssBaseline from '@mui/joy/CssBaseline';", tag: 'CssVarsProvider', baseline: '<CssBaseline />' },
  material: { imp: "import { ThemeProvider } from '@mui/material/styles';\nimport CssBaseline from '@mui/material/CssBaseline';", tag: 'ThemeProvider', baseline: '<CssBaseline />' },
  antd: { imp: "import { ConfigProvider } from 'antd';", tag: 'ConfigProvider', baseline: null },
};
const p = providerByUi[ui];
const wrapJsx = (innerLines, indent) => {
  const pad = ' '.repeat(indent);
  return [
    `${pad}<${p.tag} theme={theme}>`,
    ...(p.baseline ? [`${pad}  ${p.baseline}`] : []),
    ...innerLines.map((line) => `${pad}  ${line}`),
    `${pad}</${p.tag}>`,
  ].join('\n');
};

files['src/assets/theme.ts'] = themeByUi[ui];

files['src/main.tsx'] = `import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
${p.imp}
import { store } from 'store';

import { theme } from 'assets/theme';

import { App } from './App';

const QUERY_RETRIES = 1;

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: QUERY_RETRIES, refetchOnWindowFocus: false } },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
${wrapJsx(['<App />'], 8)}
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>,
);
`;

files['src/App.tsx'] = `import React from 'react';
import { BrowserRouter } from 'react-router-dom';

import { Router } from 'routing/Router';

export const App: React.FC = () => (
  <BrowserRouter>
    <Router />
  </BrowserRouter>
);
`;

files['src/routing/Router/index.tsx'] = `import React, { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

const Home = lazy(() => import('pages/Home'));

export const Router: React.FC = () => (
  <Suspense fallback={null}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<Home />} />
    </Routes>
  </Suspense>
);
`;

files['src/pages/Home/index.tsx'] = `import React from 'react';

const Home: React.FC = () => <main>${name}</main>;

export default Home;
`;

files['src/store/index.ts'] = `import { configureStore } from '@reduxjs/toolkit';

import { rootReducer } from 'store/slices';

export const store = configureStore({ reducer: rootReducer });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
`;

files['src/store/slices/index.ts'] = `import { combineReducers } from '@reduxjs/toolkit';

import { appSlice } from 'store/slices/app';

export const rootReducer = combineReducers({
  app: appSlice.reducer,
});
`;

files['src/store/slices/app/index.ts'] = `import { createSlice } from '@reduxjs/toolkit';

type AppState = {
  isInitialized: boolean;
};

const initialState: AppState = { isInitialized: false };

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    initialize: (state) => {
      state.isInitialized = true;
    },
  },
});
`;

files['src/store/hooks.ts'] = `import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from 'store';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
`;

files['src/constants/index.ts'] = `export const TOKEN_KEY = '${name}-token';\n`;

files['src/utils/date/formats.ts'] = `export const DISPLAY_DATE = '${dates === 'luxon' ? 'yyyy-MM-dd' : 'yyyy-MM-dd'}';\n`;
files['src/utils/date/index.ts'] = dates === 'luxon'
  ? `import { DateTime } from 'luxon';

import { DISPLAY_DATE } from 'utils/date/formats';

export const formatDisplayDate = (iso: string): string => DateTime.fromISO(iso).toFormat(DISPLAY_DATE);
`
  : `import { format, parseISO } from 'date-fns';

import { DISPLAY_DATE } from 'utils/date/formats';

export const formatDisplayDate = (iso: string): string => format(parseISO(iso), DISPLAY_DATE);
`;

if (data === 'axios') {
  files['src/services/api/index.ts'] = `import axios from 'axios';

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

const restApi = axios.create({ baseURL: '/api' });

export const setToken = (token?: string): void => {
  restApi.defaults.headers.common.Authorization = \`Bearer \${token}\`;
};

restApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if ([HTTP_UNAUTHORIZED, HTTP_FORBIDDEN].includes(error.response?.status)) {
      console.warn('Unauthorized — redirect to authentication');
      return;
    }

    return Promise.reject(error.response);
  },
);

export default restApi;
`;
  files['src/requests/health/types.ts'] = `export type HealthResponse = {
  status: string;
};
`;
  files['src/requests/health/index.ts'] = `import { HealthResponse } from 'requests/health/types';

import restApi from 'services/api';

export const fetchHealth = (): Promise<HealthResponse> => restApi.get('/health').then((response) => response.data);
`;
  files['src/hooks/useHealth.ts'] = `import { UseQueryResult, useQuery } from '@tanstack/react-query';

import { HealthResponse } from 'requests/health/types';
import { fetchHealth } from 'requests/health';

export const useHealth = (): UseQueryResult<HealthResponse> => useQuery({ queryKey: ['health'], queryFn: fetchHealth });
`;
} else {
  files['src/core/apollo/index.ts'] = `import { ApolloClient, InMemoryCache } from '@apollo/client';

export const apolloClient = new ApolloClient({
  uri: '/api/graphql',
  cache: new InMemoryCache(),
});
`;
  files['src/requests/health/types.ts'] = `export type HealthResponse = {
  health: {
    status: string;
  };
};
`;
  files['src/requests/health/index.ts'] = `import { QueryResult, gql, useQuery } from '@apollo/client';

import { HealthResponse } from 'requests/health/types';

const HEALTH = gql\`
  query Health {
    health {
      status
    }
  }
\`;

export const useHealthQuery = (): QueryResult<HealthResponse> => useQuery<HealthResponse>(HEALTH);
`;
}

/* testing (frontend-unit-test canon, Vitest flavor) */
files['src/utils/testing/vitest.setup.ts'] = `import '@testing-library/jest-dom/vitest';

const noop = (): void => {};

window.matchMedia =
  window.matchMedia ??
  (((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: noop,
    removeListener: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: (): boolean => false,
  })) as never);

window.ResizeObserver =
  window.ResizeObserver ??
  (function ResizeObserverStub() {
    return { observe: noop, unobserve: noop, disconnect: noop };
  } as never);
`;

files['src/utils/testing/renderWithProviders.tsx'] = `import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
${p.imp}

import { theme } from 'assets/theme';

import { rootReducer } from 'store/slices';

type Options = Omit<RenderOptions, 'wrapper'> & {
  preloadedState?: Partial<ReturnType<typeof rootReducer>>;
  initialEntries?: string[];
};

type RenderWithProvidersResult = ReturnType<typeof render> & {
  store: ReturnType<typeof configureStore>;
  user: ReturnType<typeof userEvent.setup>;
};

export const renderWithProviders = (ui: ReactElement, options: Options = {}): RenderWithProvidersResult => {
  const { preloadedState, initialEntries = ['/'], ...renderOptions } = options;
  const store = configureStore({ reducer: rootReducer, preloadedState });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const Wrapper = ({ children }: { children: ReactNode }): ReactElement => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
${wrapJsx(['<MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>'], 8)}
      </QueryClientProvider>
    </Provider>
  );

  return { store, user: userEvent.setup(), ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
};
`;

files['src/pages/Home/index.test.tsx'] = `import React from 'react';
import { screen } from '@testing-library/react';

import { renderWithProviders } from 'utils/testing/renderWithProviders';

import Home from '.';

it('renders the app name', () => {
  renderWithProviders(<Home />);

  expect(screen.getByText('${name}')).toBeInTheDocument();
});
`;

/* structure markers */
['components/ui', 'components/form', 'components/common', 'hooks', 'mappers', 'types', 'utils', 'icons'].forEach((dir) => {
  files[`src/${dir}/.gitkeep`] = '';
});

/* extras */
if (extras.includes('intl')) {
  files['src/translations/en.ts'] = `export const en = {
  appTitle: '${name}',
} as const;

export type Translation = keyof typeof en;
`;
  files['src/hooks/useLocalization.ts'] = `import { useIntl } from 'react-intl';

import { Translation } from 'translations/en';

export const useLocalization = (): ((key: Translation) => string) => {
  const intl = useIntl();
  return (key) => intl.formatMessage({ id: key });
};
`;
}
if (extras.includes('sockets')) {
  files['src/services/websocket/constants.ts'] = `export const JOIN_ROOM = 'JOIN_ROOM' as const;
export const LEAVE_ROOM = 'LEAVE_ROOM' as const;

export type EventName = typeof JOIN_ROOM | typeof LEAVE_ROOM;
`;
  files['src/services/websocket/index.ts'] = `import { Socket, io } from 'socket.io-client';

import { TOKEN_KEY } from 'constants/index';

import { JOIN_ROOM, LEAVE_ROOM } from 'services/websocket/constants';

let wsSocket: Socket | null = null;

const connect = (): Promise<Socket> => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (!token) {
    return Promise.reject(new Error('no token for socket connect'));
  }
  if (wsSocket) {
    return Promise.resolve(wsSocket);
  }

  return new Promise((resolve, reject) => {
    const socket = io('/', {
      transports: ['websocket'],
      auth: { token },
    });

    socket.on('connect', () => {
      wsSocket = socket;
      resolve(socket);
    });

    socket.on('disconnect', (reason) => {
      wsSocket = null;
      console.warn('socket disconnected:', reason);
      reject(reason);
    });
  });
};

type WebsocketApi = {
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
  subscribe: <T>(event: string, handler: (data: T) => void) => () => void;
  disconnect: () => void;
};

export const websocket = async (): Promise<WebsocketApi> => {
  const socket = await connect();

  return {
    joinRoom: (room: string): void => {
      socket.emit(JOIN_ROOM, { room });
    },
    leaveRoom: (room: string): void => {
      socket.emit(LEAVE_ROOM, { room });
    },
    subscribe: <T>(event: string, handler: (data: T) => void): (() => void) => {
      socket.on(event, handler as never);
      return () => socket.off(event, handler as never);
    },
    disconnect: (): void => {
      socket.disconnect();
    },
  };
};
`;
}
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
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run tsc
      - run: npm test
      - run: npm run build
`;
}
if (extras.includes('husky')) {
  files['.husky/pre-commit'] = 'npx lint-staged\n';
}

/* ---------------- write ---------------- */
Object.entries(files).forEach(([relPath, content]) => {
  const full = join(root, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
});

console.log(`
Created ${name}/ — ui=${ui}, data=${data}, port=${port}, extras=${extras.join(',') || 'none'}

Next steps:
  cd ${name}
  npm install
  cp .env.example .env
  npm run lint && npm run tsc && npm test
  git init && git add -A
${extras.includes('husky') ? '  npm run prepare   # activates husky' : ''}
  graphify extract . --code-only   # builds graphify-out/graph.json; .mcp.json already registers the MCP (mac/linux: edit command py -> python3)
Canon: frontend-development skill. Tests-first: frontend-unit-test skill.
`);
