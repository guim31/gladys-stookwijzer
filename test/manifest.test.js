// -----------------------------------------------------------------------------
// The manifest tied to the code: identity, capabilities and the Gladys version
// they need, defaults, the scene triggers the monitor fires with exactly the
// declared keys, the widget handler.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG, LANGUAGES } from '../src/config.js';
import { TRIGGERS, WIDGET_KEY } from '../src/monitor.js';
import { WIDGETS } from '../src/widgets.js';
import { HOUSES, create, createWorld, cycle } from './helpers/world.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const keysOf = (list = []) => list.map((entry) => entry.key);
const field = (list, key) => list.find((entry) => entry.key === key);
const allFields = [
  ...manifest.config_schema,
  ...(manifest.scene_triggers ?? []).flatMap((trigger) => trigger.fields ?? []),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];

// The handlers the integration actually registers on the SDK.
const { gladys: registered, app } = await createWorld({ connect: false });
await app.stop();
const handlerKeys = (prefix) =>
  Object.keys(registered.handlers)
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));

test('identity: name, image, cover, cloud transport, environment category', () => {
  assert.equal(manifest.name, 'Stookwijzer');
  assert.equal(manifest.type, 'device');
  assert.match(manifest.docker_image, /^ghcr\.io\/guim31\/gladys-stookwijzer:/);
  assert.equal(
    manifest.cover_image,
    'https://raw.githubusercontent.com/guim31/gladys-stookwijzer/main/cover.png',
  );
  assert.deepEqual(manifest.transports, ['cloud']);
  assert.deepEqual(manifest.categories, ['environment']);
});

test('the houses of Gladys are read: the manifest declares the location', () => {
  assert.equal(manifest.location, true);
});

test('Gladys 5.1.0 at least: widgets and scene triggers', () => {
  const [major, minor] = manifest.gladys_version
    .match(/(\d+)\.(\d+)\.(\d+)/)
    .slice(1)
    .map(Number);
  assert.ok(major > 5 || (major === 5 && minor >= 1), manifest.gladys_version);
});

test('no configuration action and no scene action', () => {
  assert.equal(manifest.actions, undefined);
  assert.equal(manifest.scene_actions, undefined);
  assert.deepEqual(handlerKeys('action:'), []);
  assert.deepEqual(handlerKeys('sceneAction:'), []);
});

test('the scene triggers the monitor fires are declared, with exactly their keys', async (t) => {
  assert.deepEqual(keysOf(manifest.scene_triggers), Object.values(TRIGGERS));
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, HOUSES.amsterdam);
  world.rivm.set('amsterdam', { advies_6: 2, definitief_6: true });
  await cycle(world, 10);
  world.rivm.set('amsterdam', { advies_0: 2 });
  await cycle(world, 10);
  world.rivm.set('amsterdam', { advies_0: 0 });
  await cycle(world, 10);
  const fired = world.fake.sceneEvents.map((event) => event.key);
  assert.deepEqual([...new Set(fired)].sort(), Object.values(TRIGGERS).sort());
  for (const event of world.fake.sceneEvents) {
    const trigger = field(manifest.scene_triggers, event.key);
    const declared = [...keysOf(trigger.fields), ...keysOf(trigger.variables)];
    assert.deepEqual(Object.keys(event.data).sort(), declared.sort(), event.key);
    assert.equal(event.data.house, device.external_id, 'the house filter is the device');
    for (const entry of trigger.fields.filter((f) => f.options)) {
      assert.ok(
        entry.options.map((option) => option.value).includes(event.data[entry.key]),
        `${event.key}.${entry.key}`,
      );
    }
    for (const variable of trigger.variables) {
      assert.equal(typeof event.data[variable.key], variable.type, `${event.key}.${variable.key}`);
    }
  }
});

test('every widget has its handler, and vice versa', () => {
  assert.deepEqual(keysOf(manifest.widgets), [WIDGET_KEY]);
  assert.deepEqual(Object.keys(WIDGETS), [WIDGET_KEY]);
  assert.deepEqual(handlerKeys('widget:'), [WIDGET_KEY]);
});

test('config_schema defaults and options are the ones of the code', () => {
  for (const entry of manifest.config_schema) {
    if (entry.default !== undefined) {
      assert.equal(DEFAULT_CONFIG[entry.key], entry.default, entry.key);
    }
  }
  assert.deepEqual(
    Object.keys(DEFAULT_CONFIG).sort(),
    manifest.config_schema
      .filter((entry) => entry.type !== 'section')
      .map((entry) => entry.key)
      .sort(),
  );
  assert.deepEqual(
    field(manifest.config_schema, 'language').options.map((option) => option.value),
    LANGUAGES,
  );
});

test('section fields are purely presentational', () => {
  for (const section of manifest.config_schema.filter((entry) => entry.type === 'section')) {
    assert.equal(section.required, undefined);
    assert.equal(section.default, undefined);
    for (const link of section.links ?? []) {
      assert.match(link.url, /^https:\/\//);
    }
  }
});

test('dynamic selects declare the devices source and no static options', () => {
  const dynamic = allFields.filter((entry) => entry.source !== undefined);
  assert.equal(dynamic.length, 4);
  for (const entry of dynamic) {
    assert.equal(entry.source, 'devices');
    assert.equal(entry.options, undefined, entry.key);
    assert.notEqual(entry.required, true, `${entry.key}: optional, the first house by default`);
  }
});

test('manifest version, package version and image tag agree', () => {
  assert.equal(manifest.version, pkg.version);
  assert.ok(manifest.docker_image.endsWith(`:${manifest.version}`));
});

test('catalog description: 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(text.length >= 10 && text.length <= 100, `description.${lang}: ${text.length}`);
  }
});
