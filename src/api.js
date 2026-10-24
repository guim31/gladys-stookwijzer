// -----------------------------------------------------------------------------
// The RIVM Stookwijzer, read from the open geo service of the RIVM
// (data.rivm.nl/geo/alo, layer `stookwijzer_v2`, the one the Stookwijzer page
// and the Home Assistant integration read). No account, no key.
//
// One WFS GetFeature per house: the 4-digit postcode area containing the
// point (RD New), its attributes only (no geometry). The answer:
//
//   pc4            "3512"               the postcode area
//   model_runtime  "24-10-2026 04:00"   start of the current block, Dutch time
//   lki            1                    air quality index (LKI, PM2.5), 1-11
//   wind           7.7                  wind speed, m/s
//   wind_bft       4                    wind force, Beaufort
//   advies_0/6/12/18      0|1|2         code yellow / orange / red, per block
//   definitief_0/6/12/18  true|false    final advice (current and next block)
//
// The blocks run 04-10, 10-16, 16-22 and 22-04 Dutch time; advies_N is the
// block starting N hours after model_runtime.
// -----------------------------------------------------------------------------

import { dutchTime, runtimeFields } from './time.js';

export const WFS_URL = 'https://data.rivm.nl/geo/alo/wfs';
export const LAYER = 'stookwijzer_v2';
export const OFFSETS = [0, 6, 12, 18];

// Codes of the API: 0 yellow, 1 orange, 2 red ("code green" deliberately
// does not exist: not burning wood is always the best advice).
export const CODES = ['yellow', 'orange', 'red'];

const PROPERTIES = [
  'pc4',
  'model_runtime',
  'lki',
  'wind',
  'wind_bft',
  ...OFFSETS.flatMap((offset) => [`advies_${offset}`, `definitief_${offset}`]),
];

export const USER_AGENT =
  'gladys-stookwijzer (Gladys Assistant integration; +https://github.com/guim31/gladys-stookwijzer)';

export class StookwijzerError extends Error {
  /**
   * @param {string} message
   * @param {'network'|'http'|'format'|'outside'} kind
   */
  constructor(message, kind) {
    super(message);
    this.name = 'StookwijzerError';
    this.kind = kind;
  }
}

/** The WFS request for the postcode area containing a point (RD New, metres). */
export function adviceUrl({ x, y }) {
  const params = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: LAYER,
    outputFormat: 'application/json',
    propertyName: PROPERTIES.join(','),
    count: '1',
    CQL_FILTER: `INTERSECTS(shape,POINT(${Math.round(x)} ${Math.round(y)}))`,
  });
  return `${WFS_URL}?${params}`;
}

const number = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const code = (value) => {
  const parsed = number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed < CODES.length ? parsed : null;
};

/**
 * The answer of the geo service, made usable.
 * @param {unknown} body parsed JSON
 * @returns {{ postcode: string, runtime: Date, lki: number|null, windMs: number|null,
 *   windBft: number|null, blocks: { start: Date, end: Date, code: number|null, final: boolean }[] }}
 */
export function parseAdvice(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.features)) {
    throw new StookwijzerError('the answer is not a feature collection', 'format');
  }
  const properties = body.features[0]?.properties;
  if (!properties) {
    throw new StookwijzerError('no Stookwijzer area at this location', 'outside');
  }
  const fields = runtimeFields(properties.model_runtime);
  if (!fields) {
    throw new StookwijzerError(
      `unreadable model_runtime ${JSON.stringify(properties.model_runtime)}`,
      'format',
    );
  }
  // The blocks follow the Dutch clock (22:00-04:00 also on the night of a
  // daylight saving change, then 5 or 7 hours long).
  const at = (hours) =>
    dutchTime(fields.year, fields.month, fields.day, fields.hour + hours, fields.minute);
  const runtime = at(0);
  const blocks = OFFSETS.map((offset) => {
    return {
      start: at(offset),
      end: at(offset + 6),
      code: code(properties[`advies_${offset}`]),
      final:
        properties[`definitief_${offset}`] === true ||
        properties[`definitief_${offset}`] === 'True',
    };
  });
  if (blocks.every((block) => block.code === null)) {
    throw new StookwijzerError('no advice in the answer', 'format');
  }
  const windMs = number(properties.wind);
  return {
    postcode: String(properties.pc4 ?? ''),
    runtime,
    lki: number(properties.lki),
    windMs: windMs === null ? null : Math.round(windMs * 10) / 10,
    windBft: number(properties.wind_bft),
    blocks,
  };
}

/**
 * The blocks still to come at `now`: the current one first. The layer is
 * refreshed every block; if it lags, the blocks already over are dropped
 * rather than shown as current.
 */
export function upcomingBlocks(advice, now) {
  return advice.blocks.filter((block) => block.end.getTime() > now.getTime());
}

/**
 * Reads the advice for a point.
 * @param {Function} fetchImpl fetch
 * @param {{ x: number, y: number }} point RD New
 * @param {{ timeoutMs?: number }} [options]
 */
export async function fetchAdvice(fetchImpl, point, { timeoutMs = 20000 } = {}) {
  let response;
  try {
    response = await fetchImpl(adviceUrl(point), {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason =
      err?.name === 'TimeoutError' ? `no answer in ${timeoutMs / 1000} s` : err.message;
    throw new StookwijzerError(`data.rivm.nl: ${reason}`, 'network');
  }
  if (response.status !== 200) {
    throw new StookwijzerError(`data.rivm.nl: HTTP ${response.status}`, 'http');
  }
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    // GeoServer answers its exceptions in XML, with a 200.
    throw new StookwijzerError('data.rivm.nl: the answer is not JSON', 'format');
  }
  return parseAdvice(body);
}
