#!/usr/bin/env node
/* npx engineering-workflow <frontend|backend> [name] [options]
 * Dispatches to the scaffolding CLIs. Everything after the subcommand is passed through.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const CLIS = {
  frontend: join(here, '..', 'plugin', 'skills', 'create-frontend-project', 'cli', 'create-frontend-project.mjs'),
  backend: join(here, '..', 'plugin', 'skills', 'create-backend-project', 'cli', 'create-backend-project.mjs'),
};

const [subcommand, ...rest] = process.argv.slice(2);

if (!CLIS[subcommand]) {
  console.log(`Usage:
  npx engineering-workflow frontend <name> [--ui=joy|material|antd] [--data=axios|graphql] [--port=N] [--extras=husky,ci,intl,sockets]
  npx engineering-workflow backend  <name> [--db=mongo|none] [--redis] [--cron] [--events] [--sockets] [--deploy=helm] [--extras=husky,ci]

The Claude workflow itself installs as org/marketplace plugins, not via npx.`);
  process.exit(subcommand ? 1 : 0);
}

const result = spawnSync(process.execPath, [CLIS[subcommand], ...rest], { stdio: 'inherit' });
process.exit(result.status ?? 0);
