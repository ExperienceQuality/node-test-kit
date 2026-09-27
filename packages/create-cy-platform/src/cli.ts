#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

type Mode = 'greenfield' | 'brownfield';
export type Options = { mode: Mode; target: string; dryRun: boolean; force: boolean; install: boolean; platformSpec: string };
const platformDefault = 'cy-platform@^0.1.0';
const config = "import { defineConfig } from 'cypress';\nimport { setupPlatform } from 'cy-platform/node';\n\nexport default defineConfig({ e2e: { setupNodeEvents(on, config) { return setupPlatform(on, config); } } });\n";
const support = "import 'cy-platform';\n";
const tsconfig = '{\n  "compilerOptions": { "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler", "types": ["cypress"], "noEmit": true, "strict": true },\n  "include": ["**/*.ts"]\n}\n';
const gitignore = 'node_modules/\ncypress/screenshots/\ncypress/videos/\ncypress/downloads/\n';

export function parseArgs(argv: string[]): Options {
  const [modeValue, targetValue, ...flags] = argv;
  if (modeValue !== 'greenfield' && modeValue !== 'brownfield') throw new Error('mode must be greenfield or brownfield');
  if (!targetValue || targetValue.startsWith('-')) throw new Error('target directory is required');
  let dryRun = false; let force = false; let install = false;
  for (const flag of flags) { if (flag === '--dry-run') dryRun = true; else if (flag === '--force') force = true; else if (flag === '--install') install = true; else if (flag !== '--help' && flag !== '-h') throw new Error(`unknown option: ${flag}`); }
  return { mode: modeValue, target: resolve(targetValue), dryRun, force, install, platformSpec: process.env.CY_PLATFORM_SPEC ?? platformDefault };
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) { console.log('Usage: create-cy-platform <greenfield|brownfield> <directory> [--dry-run] [--force] [--install]'); return; }
  const options = parseArgs(argv); const target = options.target; const packagePath = resolve(target, 'package.json');
  if (options.mode === 'greenfield') { if (existsSync(target) && (await readdir(target)).length > 0) throw new Error(`greenfield target must be empty: ${target}`); await ensureDir(target, options.dryRun); }
  else if (!existsSync(packagePath)) throw new Error(`brownfield target needs package.json: ${target}`);
  const pkg = existsSync(packagePath) ? JSON.parse(await readFile(packagePath, 'utf8')) as Record<string, any> : { name: target.split('/').pop() || 'cypress-project', version: '1.0.0' };
  pkg.type ??= 'module'; pkg.private ??= true; pkg.scripts = { ...(pkg.scripts ?? {}), 'cypress:open': 'cypress open', 'cypress:run': 'cypress run' }; pkg.devDependencies = { ...(pkg.devDependencies ?? {}), cypress: '^16.1.0', 'cy-platform': options.platformSpec };
  await writeJson(packagePath, pkg, options); await writeFileSafe(resolve(target, 'cypress.config.ts'), config, options); await writeFileSafe(resolve(target, 'cypress/support/e2e.ts'), support, options); await writeFileSafe(resolve(target, 'cypress/tsconfig.json'), tsconfig, options); if (!existsSync(resolve(target, '.gitignore'))) await writeFileSafe(resolve(target, '.gitignore'), gitignore, options); if (options.install) await npmInstall(target, options.platformSpec, options.dryRun); console.log(`scaffolded ${options.mode} Cypress project at ${target}`);
}
async function ensureDir(path: string, dryRun: boolean): Promise<void> { if (dryRun) console.log(`would create directory ${path}`); else await mkdir(path, { recursive: true }); }
async function writeJson(path: string, value: Record<string, any>, options: Options): Promise<void> { await writeFileSafe(path, `${JSON.stringify(value, null, 2)}\n`, options); }
async function writeFileSafe(path: string, content: string, options: Options): Promise<void> { if (existsSync(path) && !options.force) { if (await readFile(path, 'utf8') === content) return; throw new Error(`refusing to overwrite existing file: ${path} (use --force)`); } if (options.dryRun) { console.log(`would write ${path}`); return; } await mkdir(dirname(path), { recursive: true }); await writeFile(path, content); }
function npmInstall(target: string, platformSpec: string, dryRun: boolean): Promise<void> { const args = ['install', '--save-dev', 'cypress@^16.1.0', platformSpec]; if (dryRun) { console.log(`would run npm ${args.join(' ')}`); return Promise.resolve(); } return new Promise((done, fail) => { const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd: target, stdio: 'inherit' }); child.on('error', fail); child.on('exit', (code) => code === 0 ? done() : fail(new Error(`npm install exited with code ${code ?? 1}`))); }); }
if (process.argv[1]?.endsWith('/cli.js') || process.argv[1]?.endsWith('\\cli.js')) main().catch((error: Error) => { console.error(`create-cy-platform: ${error.message}`); process.exitCode = 1; });
