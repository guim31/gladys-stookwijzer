// -----------------------------------------------------------------------------
// The RIVM client, on the answers recorded on 24/10/2026, the RD New
// conversion and the Dutch time of the blocks.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  StookwijzerError,
  adviceUrl,
  fetchAdvice,
  parseAdvice,
  upcomingBlocks,
} from '../src/api.js';
import { nearTheNetherlands, toRdNew } from '../src/rd.js';
import { formatHour, parseRuntime } from '../src/time.js';
import { FakeRivm, PLACES, RECORDED_AT, loadAnswers } from './helpers/world.js';

const answers = await loadAnswers();

test('RD New: Amersfoort is the origin, Amsterdam and Groningen where the RIVM puts them', () => {
  assert.deepEqual(toRdNew(52.1551744, 5.38720621), { x: 155000, y: 463000 });
  // Dam square, Amsterdam: RD 121290 487362 (within a few metres).
  const amsterdam = toRdNew(PLACES.amsterdam.latitude, PLACES.amsterdam.longitude);
  assert.ok(Math.abs(amsterdam.x - 121290) < 5 && Math.abs(amsterdam.y - 487362) < 5);
  const groningen = toRdNew(PLACES.groningen.latitude, PLACES.groningen.longitude);
  assert.ok(Math.abs(groningen.x - 233770) < 5 && Math.abs(groningen.y - 582065) < 5);
});

test('only the surroundings of the Netherlands are asked', () => {
  assert.ok(nearTheNetherlands(52.37, 4.89));
  assert.ok(nearTheNetherlands(50.85, 5.69)); // Maastricht
  assert.ok(!nearTheNetherlands(48.8566, 2.3522)); // Paris
  assert.ok(!nearTheNetherlands(52.52, 13.4)); // Berlin
});

test('the request asks the postcode area of the point, attributes only', () => {
  const url = new URL(adviceUrl({ x: 121290.4, y: 487362.6 }));
  assert.equal(url.origin + url.pathname, 'https://data.rivm.nl/geo/alo/wfs');
  assert.equal(url.searchParams.get('typeNames'), 'stookwijzer_v2');
  assert.equal(url.searchParams.get('CQL_FILTER'), 'INTERSECTS(shape,POINT(121290 487363))');
  assert.match(url.searchParams.get('propertyName'), /advies_18/);
  assert.doesNotMatch(url.searchParams.get('propertyName'), /shape/);
  assert.equal(url.searchParams.get('servicekey'), null, 'no key needed');
});

test('model_runtime is Dutch local time, summer and winter, across the change', () => {
  // 24/10/2026: summer time (UTC+2).
  assert.equal(parseRuntime('24-10-2026 04:00').toISOString(), '2026-10-24T02:00:00.000Z');
  // 25/10/2026: back to winter time at 03:00, 04:00 is UTC+1.
  assert.equal(parseRuntime('25-10-2026 04:00').toISOString(), '2026-10-25T03:00:00.000Z');
  assert.equal(parseRuntime('24-12-2026 22:00').toISOString(), '2026-12-24T21:00:00.000Z');
  assert.equal(parseRuntime('2026-10-24 04:00'), null);
  assert.equal(parseRuntime(undefined), null);
});

test('hours are shown in the time zone of Gladys', () => {
  const date = new Date('2026-10-24T02:00:00Z');
  assert.equal(formatHour(date, 'Europe/Amsterdam'), '04:00');
  assert.equal(formatHour(date, 'Europe/London'), '03:00');
  assert.equal(formatHour(date, 'Not/AZone'), '04:00', 'an unknown TZ falls back to Dutch time');
});

test('the recorded answer of Amsterdam', () => {
  const advice = parseAdvice(answers.amsterdam);
  assert.equal(advice.postcode, '1012');
  assert.equal(advice.runtime.toISOString(), '2026-10-24T02:00:00.000Z');
  assert.equal(advice.windMs, 8.8);
  assert.equal(advice.windBft, 5);
  assert.equal(advice.lki, 1);
  assert.deepEqual(
    advice.blocks.map((block) => [block.start.toISOString(), block.code, block.final]),
    [
      ['2026-10-24T02:00:00.000Z', 0, true],
      ['2026-10-24T08:00:00.000Z', 0, true],
      ['2026-10-24T14:00:00.000Z', 0, false],
      ['2026-10-24T20:00:00.000Z', 0, false],
    ],
  );
});

test('Utrecht and Groningen have their own postcode areas', () => {
  assert.equal(parseAdvice(answers.utrecht).postcode, '3512');
  assert.equal(parseAdvice(answers.groningen).postcode, '9712');
  assert.equal(parseAdvice(answers.groningen).windMs, 6.3);
});

test('outside every postcode area, the advice says so', () => {
  assert.throws(
    () => parseAdvice(answers['north-sea']),
    (err) => err instanceof StookwijzerError && err.kind === 'outside',
  );
});

test('unexpected answers are format errors, never a wrong advice', () => {
  const broken = structuredClone(answers.amsterdam);
  broken.features[0].properties.model_runtime = 'soon';
  assert.throws(() => parseAdvice(broken), { kind: 'format' });
  const noAdvice = structuredClone(answers.amsterdam);
  for (const offset of [0, 6, 12, 18]) {
    noAdvice.features[0].properties[`advies_${offset}`] = 7;
  }
  assert.throws(() => parseAdvice(noAdvice), { kind: 'format' });
  assert.throws(() => parseAdvice({ error: 'x' }), { kind: 'format' });
  const strings = structuredClone(answers.amsterdam);
  Object.assign(strings.features[0].properties, { advies_0: '2', definitief_0: 'True' });
  assert.deepEqual(
    [parseAdvice(strings).blocks[0].code, parseAdvice(strings).blocks[0].final],
    [2, true],
  );
});

test('the blocks follow the Dutch clock, also on the night of the change of time', () => {
  const blocks = parseAdvice(answers.amsterdam).blocks;
  // 25/10/2026 03:00 summer time is 02:00 winter time: the night block is 7 hours long.
  assert.equal(blocks[3].start.toISOString(), '2026-10-24T20:00:00.000Z'); // 22:00 CEST
  assert.equal(blocks[3].end.toISOString(), '2026-10-25T03:00:00.000Z'); // 04:00 CET
});

test('blocks already over are dropped when the layer lags', () => {
  const advice = parseAdvice(answers.amsterdam);
  assert.equal(upcomingBlocks(advice, RECORDED_AT).length, 4);
  const later = new Date(RECORDED_AT.getTime() + 7 * 3600 * 1000); // 13:20 Dutch time
  const blocks = upcomingBlocks(advice, later);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[0].start.toISOString(), '2026-10-24T08:00:00.000Z');
});

test('fetchAdvice: network, HTTP and XML failures', async () => {
  const rivm = new FakeRivm(answers);
  const point = toRdNew(PLACES.utrecht.latitude, PLACES.utrecht.longitude);
  assert.equal((await fetchAdvice(rivm.fetch, point)).postcode, '3512');
  rivm.failure = 'network';
  await assert.rejects(fetchAdvice(rivm.fetch, point), { kind: 'network' });
  rivm.failure = 503;
  await assert.rejects(fetchAdvice(rivm.fetch, point), {
    kind: 'http',
    message: 'data.rivm.nl: HTTP 503',
  });
  rivm.failure = 'xml';
  await assert.rejects(fetchAdvice(rivm.fetch, point), { kind: 'format' });
  const slow = () => new Promise((_resolve, reject) => setTimeout(() => reject(timeout()), 5));
  const timeout = () => Object.assign(new Error('aborted'), { name: 'TimeoutError' });
  await assert.rejects(fetchAdvice(slow, point, { timeoutMs: 1000 }), {
    kind: 'network',
    message: 'data.rivm.nl: no answer in 1 s',
  });
});
