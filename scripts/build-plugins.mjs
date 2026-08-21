#!/usr/bin/env node
/* Generates the four role plugins (plugins/{full,frontend,backend,analyst}) from the
 * master in plugin/. Run after ANY change to plugin/ and commit the output:
 *   node scripts/build-plugins.mjs
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const master = join(root, 'plugin');
const out = join(root, 'plugins');

const DEV_SHARED = ['domain-modeling', 'graphify'];
const ROLES = {
  full: {
    description: 'The complete engineering workflow: all 4 commands, all 14 skills, reviewer agent.',
    commands: ['migrate', 'new-feature', 'new-fix', 'new-project'],
    skills: [
      'product-docs', ...DEV_SHARED,
      'frontend-architecture', 'frontend-unit-test', 'frontend-development', 'frontend-code-review',
      'backend-architecture', 'backend-unit-test', 'backend-development', 'backend-code-review',
      'create-frontend-project', 'create-backend-project', 'migration-planner',
    ],
  },
  frontend: {
    description: 'Frontend team: FE architecture + TDD pipeline + scaffolder + migration-planner. Business docs come from the analyst plugin.',
    commands: ['migrate', 'new-feature', 'new-fix', 'new-project'],
    skills: [
      ...DEV_SHARED,
      'frontend-architecture', 'frontend-unit-test', 'frontend-development', 'frontend-code-review',
      'create-frontend-project', 'migration-planner',
    ],
  },
  backend: {
    description: 'Backend team: BE architecture + TDD pipeline + scaffolder. Business docs come from the analyst plugin.',
    commands: ['new-feature', 'new-fix', 'new-project'],
    skills: [
      ...DEV_SHARED,
      'backend-architecture', 'backend-unit-test', 'backend-development', 'backend-code-review',
      'create-backend-project',
    ],
  },
  analyst: {
    description: 'Business analysts / staff engineers: product-docs (existing-docs intake or grilled from a prompt), domain-modeling, both architecture record skills — the front of every workflow.',
    commands: [],
    skills: ['product-docs', 'domain-modeling', 'frontend-architecture', 'backend-architecture'],
  },
};

rmSync(out, { recursive: true, force: true });

Object.entries(ROLES).forEach(([role, spec]) => {
  const dir = join(out, role);
  mkdirSync(join(dir, '.claude-plugin'), { recursive: true });

  writeFileSync(join(dir, '.claude-plugin', 'plugin.json'), JSON.stringify({
    name: `engineering-workflow-${role}`,
    description: spec.description,
    version: '0.2.0',
    author: { name: 'Ivan Kabetskyi' },
  }, null, 2));

  spec.skills.forEach((skill) => cpSync(join(master, 'skills', skill), join(dir, 'skills', skill), { recursive: true }));
  spec.commands.forEach((command) => cpSync(join(master, 'commands', `${command}.md`), join(dir, 'commands', `${command}.md`), { recursive: true }));
  if (spec.commands.length) cpSync(join(master, 'agents'), join(dir, 'agents'), { recursive: true });

  console.log(`plugins/${role}: ${spec.skills.length} skills, ${spec.commands.length} commands`);
});

writeFileSync(join(root, '.claude-plugin', 'marketplace.json'), JSON.stringify({
  name: 'ivankabetskyi',
  owner: { name: 'Ivan Kabetskyi' },
  plugins: Object.entries(ROLES).map(([role, spec]) => ({
    name: `engineering-workflow-${role}`,
    source: `./plugins/${role}`,
    description: spec.description,
  })),
}, null, 2));

console.log('marketplace.json updated (4 plugins)');
