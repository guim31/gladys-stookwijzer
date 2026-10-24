// -----------------------------------------------------------------------------
// The monitor against the SDK's fake Gladys: one device per located house in
// the Netherlands, states only for created devices and all of them again on
// creation, the scene triggers on the transitions, the connection status, the
// hourly timer.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { houseIds } from '../src/devices.js';
import { TRIGGERS } from '../src/monitor.js';
import { HOUSES, MemoryStore, create, createWorld, cycle } from './helpers/world.js';

const ids = (world, house) => houseIds(world.gladys, house.selector);

test('one device per located house in the Netherlands', async (t) => {
  const world = await createWorld({ houses: Object.values(HOUSES) });
  t.after(() => world.app.stop());
  assert.deepEqual(
    world.fake.discoveredDevices.map((device) => device.name),
    ['Stookwijzer Grachtenhuis', 'Stookwijzer Domhuis', 'Stookwijzer Noorderhuis'],
  );
  // Paris is not even asked; the boat at sea is asked once, and told outside.
  assert.equal(world.rivm.requests.length, 4);
  assert.deepEqual(world.fake.connectionStatus?.connected ?? true, true);
});

test('states only for created devices, all of them on creation', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.equal(world.fake.states.length, 0, 'nothing for a device not created yet');
  await create(world, HOUSES.amsterdam);
  const id = ids(world, HOUSES.amsterdam);
  assert.equal(world.fake.lastState(id.advice), 1, 'yellow = 1');
  assert.equal(
    world.fake.lastState(id.adviceText),
    'Yellow: Caution: burning wood causes nuisance and air pollution',
  );
  assert.equal(world.fake.lastState(id.next1), 1);
  assert.equal(world.fake.lastState(id.next3), 1);
  assert.equal(world.fake.lastState(id.windSpeed), 8.8);
  assert.equal(world.fake.lastState(id.windForce), 5);
  assert.equal(world.fake.lastState(id.lki), 1);
  assert.ok(world.fake.widgetRefreshes.length > 0, 'the widget is asked to refresh');

  // An unchanged hour publishes nothing.
  const count = world.fake.states.length;
  await cycle(world);
  assert.equal(world.fake.states.length, count);

  // A change publishes only what changed.
  world.rivm.set('amsterdam', { advies_0: 1, wind: 5.1 });
  await cycle(world);
  assert.deepEqual(
    world.fake.states.slice(count).map((s) => s.device_feature_external_id ?? s.external_id),
    [id.advice, id.adviceText, id.windSpeed].map(String),
  );
  assert.equal(world.fake.lastState(id.advice), 2, 'orange = 2');
});

test('feature names follow the configured language, French by default', async (t) => {
  const world = await createWorld({ config: { language: undefined } });
  t.after(() => world.app.stop());
  const names = world.fake.discoveredDevices[0].features.map((feature) => feature.name);
  assert.ok(names.includes('Avis actuel'));
  assert.ok(names.includes("Indice de qualité de l'air (LKI)"));
});

test('triggers: code red, end of code red, red announced; never on the first reading', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, HOUSES.amsterdam);
  assert.deepEqual(world.fake.sceneEvents, [], 'the first reading only sets the reference');

  // The next block becomes red, final: announced once.
  world.rivm.set('amsterdam', { advies_6: 2, definitief_6: true });
  await cycle(world, 10);
  await cycle(world, 10);
  // Red now.
  world.rivm.set('amsterdam', { advies_0: 2 });
  await cycle(world, 10);
  await cycle(world, 10);
  // Orange again (still in the 04:00-10:00 block: the cycles are 10 minutes apart).
  world.rivm.set('amsterdam', { advies_0: 1, advies_6: 0 });
  await cycle(world, 10);

  const events = world.fake.sceneEvents;
  assert.deepEqual(
    events.map((event) => event.key),
    [TRIGGERS.RED_ANNOUNCED, TRIGGERS.RED, TRIGGERS.RED_OVER],
  );
  assert.deepEqual(events[0].data, {
    house: device.external_id,
    advice_text: 'Red: Do not burn wood',
    starts_at: '10:00',
    ends_at: '16:00',
    postcode: '1012',
    wind_force: 5,
    lki: 1,
  });
  assert.equal(events[1].data.starts_at, '04:00');
  assert.equal(events[2].data.advice, 'orange');
});

test('a provisional red block is not announced', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, HOUSES.amsterdam);
  world.rivm.set('amsterdam', { advies_6: 2, definitief_6: false });
  await cycle(world);
  assert.deepEqual(world.fake.sceneEvents, []);
});

test('a restart neither fires again nor misses a change', async (t) => {
  const store = new MemoryStore();
  const first = await createWorld({ store });
  await create(first, HOUSES.amsterdam);
  first.rivm.set('amsterdam', { advies_0: 2 });
  await cycle(first);
  assert.equal(first.fake.sceneEvents.length, 1);
  await first.app.stop();

  // Same advice after the restart: nothing fires.
  const second = await createWorld({ store, rivm: first.rivm, houses: [HOUSES.amsterdam] });
  t.after(() => second.app.stop());
  await create(second, HOUSES.amsterdam);
  assert.deepEqual(second.fake.sceneEvents, []);
  // Changed while it was down: fired at the first reading.
  second.rivm.set('amsterdam', { advies_0: 0 });
  await cycle(second);
  assert.deepEqual(
    second.fake.sceneEvents.map((event) => event.key),
    [TRIGGERS.RED_OVER],
  );
});

test('the next block becomes current when the layer lags', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, HOUSES.amsterdam);
  world.rivm.set('amsterdam', { advies_6: 1 });
  // 13:20 Dutch time with a layer still at 04:00: the 10-16 block is current.
  await cycle(world, 7 * 60);
  assert.equal(world.fake.lastState(ids(world, HOUSES.amsterdam).advice), 2);
});

test('connection status: no located house, outside, service down, back', async (t) => {
  const none = await createWorld({ houses: [HOUSES.unlocated] });
  t.after(() => none.app.stop());
  assert.equal(none.fake.connectionStatus.connected, false);
  assert.match(none.fake.connectionStatus.message.en, /location/);

  const abroad = await createWorld({ houses: [HOUSES.paris, HOUSES.sea] });
  t.after(() => abroad.app.stop());
  assert.equal(abroad.fake.connectionStatus.connected, false);
  assert.match(abroad.fake.connectionStatus.message.fr, /hors des Pays-Bas/);
  assert.deepEqual(abroad.fake.discoveredDevices, []);

  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, HOUSES.amsterdam);
  world.rivm.failure = 503;
  await cycle(world);
  assert.equal(world.fake.connectionStatus.connected, false);
  assert.match(world.fake.connectionStatus.message.en, /does not answer/);
  // The last advice stays published, and the device stays discovered.
  assert.equal(world.fake.discoveredDevices.length, 1);
  world.rivm.failure = null;
  await cycle(world, 10);
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('a location added in Gladys is picked up by a scan', async (t) => {
  const world = await createWorld({ houses: [HOUSES.unlocated] });
  t.after(() => world.app.stop());
  world.fake.houses = [HOUSES.utrecht];
  await world.fake.scanRequest();
  assert.equal(world.fake.discoveredDevices.length, 1);
  assert.equal(world.fake.connectionStatus.connected, true);
});

test('the language change rewrites the advice text', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, HOUSES.amsterdam);
  await world.fake.configUpdated({ language: 'de' });
  assert.match(world.fake.lastState(ids(world, HOUSES.amsterdam).adviceText), /^Gelb: /);
});

test('the internal timer refreshes without any poll from Gladys', async (t) => {
  const world = await createWorld({ timers: true, timings: { refreshMs: 30, retryMs: 30 } });
  t.after(() => world.app.stop());
  await create(world, HOUSES.amsterdam);
  const before = world.rivm.requests.length;
  world.rivm.set('amsterdam', { advies_0: 1 });
  await sleep(150);
  assert.ok(world.rivm.requests.length > before);
  assert.equal(world.fake.lastState(ids(world, HOUSES.amsterdam).advice), 2);
});

test('poll fallback: reads again only when the last reading is old', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, HOUSES.amsterdam);
  const before = world.rivm.requests.length;
  await world.fake.poll(device);
  assert.equal(world.rivm.requests.length, before);
  world.clock.advance(31);
  await world.fake.poll(device);
  assert.equal(world.rivm.requests.length, before + 1);
});
