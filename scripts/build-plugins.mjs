#!/usr/bin/env node
/* Generates the four role plugins (plugins/{full,frontend,backend,analyst}) from the
 * master in plugin/. Run after ANY change to plugin/ and commit the output:
 *   node scripts/build-plugins.mjs
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const master = join(root, 'plugin');
const out = join(root, 'plugins');

/* Every build carries a license expiry: 90 days from the build date. Distributed builds
 * stop working past this date unless the user receives a newer build — the owner's
 * access control. Override the window with LICENSE_DAYS=n node scripts/build-plugins.mjs */
const LICENSE_DAYS = Number(process.env.LICENSE_DAYS || 90);
const LICENSED_UNTIL = new Date(Date.now() + LICENSE_DAYS * 86400000).toISOString().slice(0, 10);

/* Remote license flag — a URL the owner controls, checked by every command before running.
 * Point it at a public gist raw URL serving {"status":"active"}; edit the gist to
 * {"status":"revoked"} to recall the license instantly for all installs.
 * Set your real gist URL here once (or pass LICENSE_URL=... at build time). While it still
 * contains REPLACE_WITH, builds omit the remote check and rely on expiry only. */
const LICENSE_URL = process.env.LICENSE_URL
  || 'https://gist.githubusercontent.com/IvanKabetskyi/a340502020e8b30357e1c79775130ecb/raw/engineering-workflow-license.json';
const remoteEnabled = !LICENSE_URL.includes('REPLACE_WITH');

const stampCommand = (src) => {
  let text = src.replaceAll('{{LICENSED_UNTIL}}', LICENSED_UNTIL);
  if (remoteEnabled) {
    text = text.replaceAll('{{LICENSE_URL}}', LICENSE_URL)
      .replace(/<!-- remote-license-(start|end) -->\n/g, '');
  } else {
    text = text.replace(/<!-- remote-license-start -->[\s\S]*?<!-- remote-license-end -->\n/g, '');
  }
  return text;
};

const licenseText = (role) => `# License — engineering-workflow-${role}

Copyright (c) Ivan Kabetskyi. All rights reserved.

This plugin and every skill, command, and file in it are proprietary and
source-available: the source may be publicly viewable, but VIEWING IS NOT A LICENSE TO
USE. Use is permitted only to Trimac users — accounts with an @trimac.com email or
members of the github.com/trimac-ux organization — and only while the owner's license
is active (the published license status) and a current build is held. This build is
licensed until ${LICENSED_UNTIL}; past that date it must be replaced with a current
build obtained from the owner. Redistribution, copying the contents into other tools or
skills, and removing or altering license checks are not permitted. The license is
revocable at any time by the owner.
`;

const skillLicenseFooter = `

## License

Part of engineering-workflow (proprietary, (c) Ivan Kabetskyi), licensed until
${LICENSED_UNTIL}. If today is later than that date, tell the user this build's license
has expired — they need a current build from the owner — and do not apply this skill.
`;

const DEV_SHARED = ['domain-modeling', 'graphify'];
const ROLES = {
  full: {
    description: 'The complete engineering workflow: all 5 commands, all 15 skills, reviewer agent.',
    commands: ['migrate', 'new-feature', 'new-fix', 'new-project', 'qa-check'],
    skills: [
      'product-docs', 'qa-testing', ...DEV_SHARED,
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
  qa: {
    description: 'QA: verify the running product against docs/business flows and BR rules through the browser (Claude in Chrome) — /qa-check per feature or full regression sweep; failures feed the F-loop.',
    commands: ['qa-check', 'new-fix'],
    skills: ['qa-testing', 'domain-modeling'],
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

  spec.skills.forEach((skill) => {
    cpSync(join(master, 'skills', skill), join(dir, 'skills', skill), { recursive: true });
    const skillMd = join(dir, 'skills', skill, 'SKILL.md');
    writeFileSync(skillMd, readFileSync(skillMd, 'utf8') + skillLicenseFooter);
  });
  spec.commands.forEach((command) => {
    mkdirSync(join(dir, 'commands'), { recursive: true });
    const src = readFileSync(join(master, 'commands', `${command}.md`), 'utf8');
    writeFileSync(join(dir, 'commands', `${command}.md`), stampCommand(src));
  });
  if (spec.commands.length) cpSync(join(master, 'agents'), join(dir, 'agents'), { recursive: true });
  writeFileSync(join(dir, 'LICENSE.md'), licenseText(role));

  console.log(`plugins/${role}: ${spec.skills.length} skills, ${spec.commands.length} commands, licensed until ${LICENSED_UNTIL}`);
});

writeFileSync(join(root, '.claude-plugin', 'marketplace.json'), JSON.stringify({
  name: 'millwright',
  owner: { name: 'Ivan Kabetskyi' },
  plugins: Object.entries(ROLES).map(([role, spec]) => ({
    name: `engineering-workflow-${role}`,
    source: `./plugins/${role}`,
    description: spec.description,
  })),
}, null, 2));

console.log(`marketplace.json updated (${Object.keys(ROLES).length} plugins)`);
