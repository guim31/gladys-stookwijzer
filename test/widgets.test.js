// -----------------------------------------------------------------------------
// The "Stookwijzer" dashboard widget: valid for the core in every language,
// bound to features that exist, and its empty states.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from '../src/config.js';
import { WIDGET_KEY } from '../src/monitor.js';
import { HOUSES, create, createWorld, cycle } from './helpers/world.js';

const content = async (world, request) => {
  const ack = await world.fake.widgetGet(WIDGET_KEY, request);
  assert.equal(ack.success, true, JSON.stringify(ack));
  return ack.data.content;
};

test('valid in every language, bound to features of the device', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, HOUSES.amsterdam);
  const features = new Set(device.features.map((feature) => feature.external_id));
  for (const language of LANGUAGES) {
    const data = await content(world, { settings: {}, language });
    assert.deepEqual(validateWidgetContent(data), [], language);
    for (const component of data.components.filter((c) => c.device_feature)) {
      assert.ok(features.has(component.device_feature), component.device_feature);
    }
  }
});

test('the advice now and for the next blocks, provisional ones marked', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, HOUSES.amsterdam);
  world.rivm.set('amsterdam', { advies_0: 1, advies_12: 2 });
  await cycle(world, 10);
  const data = await content(world, { settings: {}, language: 'en' });
  const status = data.components.find((c) => c.type === 'status');
  assert.deepEqual(
    status.items.map((item) => [item.label, item.value, item.color]),
    [
      ['Now · 04:00–10:00', 'Orange', 'warning'],
      ['10:00–16:00', 'Yellow', 'neutral'],
      ['16:00–22:00', 'Red (provisional)', 'danger'],
      ['22:00–04:00', 'Yellow (provisional)', 'neutral'],
    ],
  );
  assert.equal(data.components[0].text, 'Better not to burn wood now');
  assert.match(data.components.find((c) => c.variant === 'caption').text, /1012/);
});

test('the chosen house, or the first created one', async (t) => {
  const world = await createWorld({ houses: [HOUSES.amsterdam, HOUSES.groningen] });
  t.after(() => world.app.stop());
  await create(world, HOUSES.amsterdam);
  const groningen = await create(world, HOUSES.groningen);
  const caption = (data) => data.components.find((c) => c.variant === 'caption').text;
  assert.match(caption(await content(world, { settings: {}, language: 'fr' })), /1012/);
  const chosen = await content(world, {
    settings: { house: groningen.external_id },
    language: 'fr',
  });
  assert.match(caption(chosen), /9712/);
});

test('empty states: no device yet, no answer yet', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const empty = await content(world, { settings: {}, language: 'de' });
  assert.match(empty.components[0].text, /Entdecken/);
  assert.deepEqual(validateWidgetContent(empty), []);

  world.rivm.failure = 'network';
  const down = await createWorld({ rivm: world.rivm });
  t.after(() => down.app.stop());
  await create(down, HOUSES.amsterdam);
  const noData = await content(down, { settings: {}, language: 'es' });
  assert.match(noData.components[0].text, /RIVM/);
});
