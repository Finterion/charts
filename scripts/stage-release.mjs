import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'https://registry.npmjs.org';

export function stageRelease({
  root = ROOT,
  run = spawnSync,
  summaryPath = process.env.GITHUB_STEP_SUMMARY,
} = {}) {
  function command(tool, args, cwd = root, allowNotFound = false) {
    const result = run(tool, args, { cwd, encoding: 'utf8' });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      if (allowNotFound && result.status > 0 &&
          JSON.parse(result.stdout).error?.code === 'E404') {
        console.log(`${args[1]} is not in the registry yet; checking staging.`);
        return [];
      }
      throw new Error(`${tool} ${args.join(' ')} failed:\n${result.stderr}\n${result.stdout}`);
    }
    return result.stdout;
  }

  function stagedVersion(name, version) {
    const items = JSON.parse(command('npm', ['stage', 'list', name, '--json', '--registry', REGISTRY]));
    if (!Array.isArray(items)) throw new Error(`Invalid staging response for ${name}`);
    const item = items.find(item => item.packageName === name && item.version === version);
    if (item && (!item.id || !['staged', 'validating'].includes(item.status) || item.tag !== 'latest')) {
      throw new Error(`Cannot reuse staging entry for ${name}@${version}: ${JSON.stringify(item)}`);
    }
    return item;
  }

  function report(message) {
    console.log(message);
    if (summaryPath) appendFileSync(summaryPath, `${message}\n\n`);
  }

  report('## npm staging (not yet published)\n\nApproval requires a maintainer authenticated with 2FA.');

  for (const directory of readdirSync(join(root, 'packages')).sort()) {
    const cwd = join(root, 'packages', directory);
    const { name, version, private: isPrivate } = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8'));
    if (isPrivate) continue;

    const response = command('npm', ['view', name, 'versions', '--json', '--registry', REGISTRY], root, true);
    const versions = typeof response === 'string' ? JSON.parse(response) : response;
    if (!Array.isArray(versions) && typeof versions !== 'string') {
      throw new Error(`Invalid published versions response for ${name}`);
    }
    if ((Array.isArray(versions) ? versions : [versions]).includes(version)) {
      report(`- ${name}@${version}: already published; skipped.`);
      continue;
    }

    let staged = stagedVersion(name, version);
    if (!staged) {
      const temporary = mkdtempSync(join(tmpdir(), 'finterion-stage-'));
      try {
        // pnpm pack replaces workspace: dependencies before npm stages the tarball.
        command('pnpm', ['pack', '--pack-destination', temporary], cwd);
        const tarballs = readdirSync(temporary).filter(file => file.endsWith('.tgz'));
        if (tarballs.length !== 1) throw new Error(`Expected one packed tarball for ${name}`);
        const output = command('npm', [
          'stage', 'publish', join(temporary, tarballs[0]),
          '--access', 'public', '--tag', 'latest', '--registry', REGISTRY,
        ]);
        console.log(output);
      } finally {
        rmSync(temporary, { recursive: true, force: true });
      }
      staged = stagedVersion(name, version);
      if (!staged) throw new Error(`Staging did not produce an entry for ${name}@${version}`);
    }
    report(`- ${name}@${version}: ${staged.status}, stage ID \`${staged.id}\`. Approve: \`npm stage approve ${staged.id}\``);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  stageRelease();
}
