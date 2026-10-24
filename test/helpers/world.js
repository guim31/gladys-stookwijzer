// -----------------------------------------------------------------------------
// A test world: the SDK's fake Gladys with houses, a fake RIVM geo service
// serving the answers recorded on 24/10/2026 (Amsterdam, Utrecht, Groningen,
// the North Sea outside every postcode area), a clock and a store in memory.
// -----------------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { toRdNew } from '../../src/rd.js';

// Quiet test output; captureLogs() raises the level where a test reads the logs.
process.env.LOG_LEVEL ??= 'silent';

const fixture = async (name) =>
  JSON.parse(await readFile(new URL(`../fixtures/rivm/${name}.json`, import.meta.url), 'utf8'));

export const PLACES = {
  amsterdam: { latitude: 52.3731, longitude: 4.8922 },
  utrecht: { latitude: 52.0907, longitude: 5.1214 },
  groningen: { latitude: 53.2194, longitude: 6.5665 },
};

export const HOUSES = {
  amsterdam: { id: 'h1', name: 'Grachtenhuis', selector: 'grachtenhuis', ...PLACES.amsterdam },
  utrecht: { id: 'h2', name: 'Domhuis', selector: 'domhuis', ...PLACES.utrecht },
  groningen: { id: 'h3', name: 'Noorderhuis', selector: 'noorderhuis', ...PLACES.groningen },
  paris: { id: 'h4', name: 'Paris', selector: 'paris', latitude: 48.8566, longitude: 2.3522 },
  // Inside the rough box around the Netherlands, but at sea: no postcode area.
  sea: { id: 'h5', name: 'Boot', selector: 'boot', latitude: 52.6, longitude: 3.6 },
  unlocated: { id: 'h6', name: 'Ergens', selector: 'ergens', latitude: null, longitude: null },
};

// The recordings were made at 06:20 Dutch time, in the 04:00-10:00 block.
export const RECORDED_AT = new Date('2026-10-24T04:20:00Z');

export class FakeRivm {
  constructor(answers) {
    this.answers = answers; // place -> recorded JSON
    this.overrides = {}; // place -> properties replacing the recorded ones
    this.failure = null; // null | 'network' | number (HTTP status) | 'xml'
    this.requests = [];
    this.fetch = async (url) => this.serve(new URL(url));
  }

  /** Changes some properties of a place, e.g. set('amsterdam', { advies_0: 2 }). */
  set(place, properties) {
    this.overrides[place] = { ...this.overrides[place], ...properties };
  }

  placeOf(url) {
    const match = /POINT\((\d+) (\d+)\)/.exec(url.searchParams.get('CQL_FILTER'));
    const [x, y] = [Number(match[1]), Number(match[2])];
    for (const [place, { latitude, longitude }] of Object.entries(PLACES)) {
      const point = toRdNew(latitude, longitude);
      if (Math.abs(point.x - x) < 50 && Math.abs(point.y - y) < 50) {
        return place;
      }
    }
    return 'north-sea';
  }

  async serve(url) {
    this.requests.push(url);
    if (this.failure === 'network') {
      throw new TypeError('fetch failed');
    }
    if (typeof this.failure === 'number') {
      return new Response('Service Unavailable', { status: this.failure });
    }
    if (this.failure === 'xml') {
      return new Response('<?xml version="1.0"?><ows:ExceptionReport/>', { status: 200 });
    }
    const place = this.placeOf(url);
    const body = structuredClone(this.answers[place]);
    if (body.features[0] && this.overrides[place]) {
      Object.assign(body.features[0].properties, this.overrides[place]);
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export class MemoryStore {
  constructor(saved = {}) {
    this.saved = structuredClone(saved);
  }
  async load() {
    return structuredClone(this.saved);
  }
  async save(data) {
    this.saved = structuredClone(data);
  }
  flush() {
    return Promise.resolve();
  }
}

export async function loadAnswers() {
  return Object.fromEntries(
    await Promise.all(
      ['amsterdam', 'utrecht', 'groningen', 'north-sea'].map(async (place) => [
        place,
        await fixture(place),
      ]),
    ),
  );
}

/**
 * @param {object} [options]
 * @param {object[]} [options.houses] houses of Gladys (default: Amsterdam)
 * @param {object} [options.config]
 * @param {MemoryStore} [options.store]
 * @param {FakeRivm} [options.rivm]
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers]
 * @param {object} [options.timings]
 */
export async function createWorld(options = {}) {
  const rivm = options.rivm ?? new FakeRivm(await loadAnswers());
  const clock = { time: (options.start ?? RECORDED_AT).getTime() };
  clock.now = () => new Date(clock.time);
  clock.advance = (minutes) => {
    clock.time += minutes * 60000;
  };
  const gladys = createFakeGladys({
    config: { language: 'en', ...options.config },
    houses: options.houses ?? [HOUSES.amsterdam],
  });
  const store = options.store ?? new MemoryStore();
  const app = registerHandlers(gladys, {
    store,
    fetch: rivm.fetch,
    timers: options.timers ?? false,
    now: clock.now,
    timings: options.timings,
  });
  if (options.connect !== false) {
    await gladys.connect();
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, rivm, clock, store };
}

/** "Add to Gladys" on the discovered device of a house. */
export async function create(world, house) {
  const device = world.fake.discoveredDevices.find((d) => d.external_id.endsWith(house.selector));
  if (!device) {
    throw new Error(`no discovered device for ${house.selector}`);
  }
  await world.fake.deviceCreated(device);
  return device;
}

/** Moves the clock and runs the hourly refresh. */
export async function cycle(world, minutes = 60) {
  world.clock.advance(minutes);
  await world.monitor.refresh();
}

export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
