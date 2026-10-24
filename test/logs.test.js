// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle
// (start, a trigger fired, a failure and its end), never one line per hourly
// reading; a failure that repeats is logged once. Never the house coordinates.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUSES, captureLogs, create, createWorld, cycle } from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

test('the start is one info line', async (t) => {
  const lines = captureLogs(t, 'info');
  const world = await createWorld({ houses: [HOUSES.amsterdam, HOUSES.paris] });
  t.after(() => world.app.stop());
  assert.deepEqual(lines.map(strip), [
    '[INFO] [stookwijzer] Started: 2 located house(s), 1 in the Netherlands',
  ]);
});

test('normal hourly readings write nothing at info', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, HOUSES.amsterdam);
  const lines = captureLogs(t, 'info');
  for (let i = 0; i < 4; i += 1) {
    world.rivm.set('amsterdam', { wind: 8 + i / 10 });
    await cycle(world, 10);
  }
  assert.deepEqual(lines, []);
});

test('a failing service is one warning, then one line when it is back', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const lines = captureLogs(t, 'info');
  world.rivm.failure = 503;
  await cycle(world, 10);
  await cycle(world, 10);
  await cycle(world, 10);
  world.rivm.failure = null;
  await cycle(world, 10);
  assert.deepEqual(lines.map(strip), [
    '[WARN] [stookwijzer] Cannot read the Stookwijzer advice of "Grachtenhuis": data.rivm.nl: HTTP 503',
    '[INFO] [stookwijzer] Stookwijzer advice of "Grachtenhuis" read again',
  ]);
});

test('debug shows the readings, never the house coordinates', async (t) => {
  const lines = captureLogs(t, 'debug');
  const world = await createWorld();
  t.after(() => world.app.stop());
  await cycle(world, 10);
  const all = lines.map((line) => line.text).join('\n');
  assert.match(all, /Refreshed 1 house/);
  assert.doesNotMatch(all, /52\.37|4\.89|121290|487362/);
});
