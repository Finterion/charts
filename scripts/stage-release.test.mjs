import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { stageRelease } from './stage-release.mjs';

function fixture(t, { versions = ['1.4.0'], staged = [], viewError, stageError } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'finterion-stage-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'packages', 'core'), { recursive: true });
  writeFileSync(join(root, 'packages', 'core', 'package.json'),
    JSON.stringify({ name: '@finterion/charts-core', version: '1.4.1' }));
  const summaryPath = join(root, 'summary');
  const calls = [];
  let packDirectory;
  const entry = {
    id: 'stage-id', packageName: '@finterion/charts-core',
    version: '1.4.1', tag: 'latest', status: 'staged',
  };
  function run(tool, args, options) {
    calls.push({ tool, args, options });
    let output = '';
    if (tool === 'pnpm') {
      packDirectory = args[2];
      writeFileSync(join(packDirectory, 'package.tgz'), 'fixture');
    } else if (args[0] === 'view') {
      if (viewError) {
        return { status: 1, stdout: JSON.stringify({ error: { code: viewError } }), stderr: viewError };
      }
      output = JSON.stringify(versions);
    } else if (args[1] === 'list') {
      output = JSON.stringify(staged);
    } else if (args[1] === 'publish') {
      if (stageError) return { status: 1, stdout: '', stderr: stageError };
      staged = [entry];
    } else {
      throw new Error(`Unexpected command: ${tool} ${args}`);
    }
    return { status: 0, stdout: output, stderr: '' };
  }
  return {
    execute: () => stageRelease({ root, run, summaryPath }),
    calls, root, summaryPath, entry,
    packedDirectory: () => packDirectory,
  };
}

test('packs with pnpm, stages the tarball, verifies it and reports approval', t => {
  const f = fixture(t);
  f.execute();
  assert.deepEqual(f.calls.map(({ tool, args }) => [tool, ...args.slice(0, 2)]), [
    ['npm', 'view', '@finterion/charts-core'],
    ['npm', 'stage', 'list'],
    ['pnpm', 'pack', '--pack-destination'],
    ['npm', 'stage', 'publish'],
    ['npm', 'stage', 'list'],
  ]);
  assert.equal(f.calls[2].options.cwd, join(f.root, 'packages', 'core'));
  assert.equal(f.calls[3].args[2], join(f.packedDirectory(), 'package.tgz'));
  assert.ok(f.calls[3].args.includes('public'));
  assert.ok(f.calls[3].args.includes('latest'));
  assert.match(readFileSync(f.summaryPath, 'utf8'), /not yet published/);
  assert.match(readFileSync(f.summaryPath, 'utf8'), /npm stage approve stage-id/);
  assert.equal(existsSync(f.packedDirectory()), false);
});

test('skips published versions and private packages', t => {
  const f = fixture(t, { versions: ['1.4.1'] });
  mkdirSync(join(f.root, 'packages', 'private'));
  writeFileSync(join(f.root, 'packages', 'private', 'package.json'), '{"private":true}');
  f.execute();
  assert.equal(f.calls.length, 1);
});

for (const status of ['staged', 'validating']) {
  test(`reruns reuse ${status} versions without packing or restaging`, t => {
    const f = fixture(t, {
      staged: [{
        id: 'existing', packageName: '@finterion/charts-core',
        version: '1.4.1', tag: 'latest', status,
      }],
    });
    f.execute();
    assert.equal(f.calls.length, 2);
    assert.match(readFileSync(f.summaryPath, 'utf8'), /approve existing/);
  });
}

test('supports a first release when npm view returns E404', t => {
  const f = fixture(t, { viewError: 'E404' });
  f.execute();
  assert.equal(f.calls.length, 5);
});

test('registry authorization errors abort rather than treating packages as missing', t => {
  const f = fixture(t, { viewError: 'E403' });
  assert.throws(f.execute, /E403/);
  assert.equal(f.calls.length, 1);
});

test('staging errors abort and clean up the tarball', t => {
  const f = fixture(t, { stageError: 'E_STAGE_REQUIRED' });
  assert.throws(f.execute, /E_STAGE_REQUIRED/);
  assert.equal(existsSync(f.packedDirectory()), false);
});

for (const overrides of [{ status: 'failed' }, { tag: 'next' }, { id: '' }]) {
  test(`invalid existing stages fail explicitly: ${JSON.stringify(overrides)}`, t => {
    const f = fixture(t);
    Object.assign(f.entry, overrides);
    // The mock publishes this entry, then the script checks its status and tag.
    assert.throws(f.execute, /Cannot reuse staging entry/);
    assert.equal(existsSync(f.packedDirectory()), false);
  });
}
