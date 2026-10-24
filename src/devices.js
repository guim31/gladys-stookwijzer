// -----------------------------------------------------------------------------
// One "Stookwijzer <house>" device per located house of Gladys, and the states
// of its features.
//
// The advice is a `risk/integer` (0-3, labelled "No risk / Low / Medium /
// High" by Gladys): yellow = 1, orange = 2, red = 3. "No risk" (0) is never
// published: the Stookwijzer deliberately has no code green.
// -----------------------------------------------------------------------------

import { DEVICE_FEATURE_CATEGORIES, DEVICE_FEATURE_TYPES } from '@gladysassistant/integration-sdk';
import { CODES } from './api.js';
import { FEATURE_NAMES, adviceSentence, text } from './texts.js';

export const DEVICE_TYPE = 'house';

// Feature keys: part of the external ids, never renamed.
export const FEATURE_KEYS = {
  advice: 'advice',
  adviceText: 'advice-text',
  next1: 'advice-next-1',
  next2: 'advice-next-2',
  next3: 'advice-next-3',
  windSpeed: 'wind-speed',
  windForce: 'wind-force',
  lki: 'lki',
};

const NEXT = ['next1', 'next2', 'next3'];

/** Gladys risk level of an API code (0 yellow, 1 orange, 2 red). */
export const riskOf = (code) => code + 1;
/** API code of a Gladys risk level. */
export const codeOfRisk = (risk) =>
  Number.isInteger(risk) && risk >= 1 && risk <= 3 ? risk - 1 : null;

/** External ids of a house device and of its features. */
export function houseIds(gladys, selector) {
  const ids = gladys.externalIds(DEVICE_TYPE, selector);
  return {
    device: ids.device,
    ...Object.fromEntries(
      Object.entries(FEATURE_KEYS).map(([name, key]) => [name, ids.feature(key)]),
    ),
  };
}

/** The house selector of a device external id, or null. */
export function selectorOfId(gladys, externalId) {
  const prefix = gladys.externalIds(DEVICE_TYPE, '').device;
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  return externalId.slice(prefix.length).split(':')[0] || null;
}

const sensor = (name, externalId, category, type, min, max, extra = {}) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  min,
  max,
  ...extra,
});

/**
 * The discovery payload of a house.
 * @param {object} gladys
 * @param {{ selector: string, name: string }} house
 * @param {string} language
 */
export function buildDevice(gladys, house, language) {
  const ids = houseIds(gladys, house.selector);
  const name = (key) => text(FEATURE_NAMES, language, key);
  const { RISK, TEXT, SPEED_SENSOR, AIRQUALITY_SENSOR } = DEVICE_FEATURE_CATEGORIES;
  const T = DEVICE_FEATURE_TYPES;
  return {
    // A brand, the same in every language.
    name: `Stookwijzer ${house.name || house.selector}`,
    external_id: ids.device,
    // Refreshed by the integration's own hourly timer (beyond the 1-minute
    // ceiling of the core's polling).
    should_poll: false,
    features: [
      sensor(name('advice'), ids.advice, RISK, T.RISK.INTEGER, 0, 3),
      sensor(name('adviceText'), ids.adviceText, TEXT, T.TEXT.TEXT, 0, 0),
      ...NEXT.map((key) => sensor(name(key), ids[key], RISK, T.RISK.INTEGER, 0, 3)),
      sensor(name('windSpeed'), ids.windSpeed, SPEED_SENSOR, T.SPEED_SENSOR.DECIMAL, 0, 60, {
        unit: 'meter-per-second',
      }),
      sensor(name('windForce'), ids.windForce, SPEED_SENSOR, T.SPEED_SENSOR.INTEGER, 0, 12),
      sensor(name('lki'), ids.lki, AIRQUALITY_SENSOR, T.AIRQUALITY_SENSOR.AQI, 1, 11, {
        unit: 'aqi',
      }),
    ],
  };
}

/**
 * The states of a house from its blocks still to come (current first).
 * @param {object} ids houseIds()
 * @param {object} advice parseAdvice()
 * @param {object[]} blocks upcomingBlocks()
 * @param {string} language
 */
export function statesOf(ids, advice, blocks, language) {
  const states = [];
  const push = (id, state) => {
    if (state !== null && state !== undefined) {
      states.push({ device_feature_external_id: id, state });
    }
  };
  const current = blocks[0];
  if (current && current.code !== null) {
    push(ids.advice, riskOf(current.code));
    states.push({
      device_feature_external_id: ids.adviceText,
      text: adviceSentence(language, CODES[current.code]),
    });
  }
  NEXT.forEach((key, index) => {
    const block = blocks[index + 1];
    if (block && block.code !== null) {
      push(ids[key], riskOf(block.code));
    }
  });
  push(ids.windSpeed, advice.windMs);
  push(ids.windForce, advice.windBft);
  push(ids.lki, advice.lki);
  return states;
}
