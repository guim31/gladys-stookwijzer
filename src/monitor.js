// -----------------------------------------------------------------------------
// The heart of the integration: reads the houses of Gladys, asks the RIVM the
// Stookwijzer advice of each one every hour, publishes the devices and their
// states, fires the scene triggers on the transitions and serves the widget.
//
// Devices are published with should_poll: false: an hour is beyond the
// 1-minute ceiling of the core's polling, so the monitor runs its own timer.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { CODES, fetchAdvice, upcomingBlocks } from './api.js';
import { buildDevice, houseIds, selectorOfId, statesOf } from './devices.js';
import { nearTheNetherlands, toRdNew } from './rd.js';
import { STATUS, adviceSentence, render } from './texts.js';
import { formatHour } from './time.js';

const logger = createLogger({ name: 'stookwijzer' });

export const TRIGGERS = {
  RED: 'advice_red',
  RED_OVER: 'advice_red_over',
  RED_ANNOUNCED: 'red_announced',
};

export const WIDGET_KEY = 'stookwijzer';

const RED = CODES.indexOf('red');

export const DEFAULT_TIMINGS = {
  // The layer changes once per 6-hour block; an hour keeps the current block
  // right within the hour, as the Home Assistant integration does.
  refreshMs: 60 * 60 * 1000,
  // After a failed reading, try again sooner.
  retryMs: 10 * 60 * 1000,
  // Re-send unchanged values, so Gladys never shows "no recent value".
  heartbeatMs: 12 * 60 * 60 * 1000,
  // Read a little after a block boundary, once the layer has moved on.
  boundaryMarginMs: 2 * 60 * 1000,
  // A reading older than this is not shown any more (the service is down):
  // Gladys then says "no recent value" instead of a frozen advice.
  maxAgeMs: 24 * 60 * 60 * 1000,
};

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake Gladys)
   * @param {object} options.store Store (src/store.js)
   * @param {Function} [options.fetch]
   * @param {boolean} [options.timers] false in the tests that drive refresh() themselves
   * @param {Function} [options.now]
   * @param {object} [options.timings]
   */
  constructor({ gladys, store, fetch: fetchImpl, timers = true, now, timings } = {}) {
    this.gladys = gladys;
    this.store = store;
    this.fetch = fetchImpl ?? globalThis.fetch;
    this.timers = timers;
    this.now = now ?? (() => new Date());
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = { language: 'fr' };
    // Located houses of Gladys: { selector, name, latitude, longitude }.
    this.houses = [];
    // Per house selector: { advice, at } of the last good reading, or { outside: true }.
    this.readings = new Map();
    // Persisted: { houses: { [selector]: { code, announced } } }.
    this.data = { houses: {} };
    // Failures logged once, until they recover: key -> true.
    this.failures = new Map();
    this.timer = null;
    this.running = null;
    this.stopped = false;
    this.lastRefreshAt = 0;
  }

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    this.data = { houses: saved.houses && typeof saved.houses === 'object' ? saved.houses : {} };
    await this.refresh();
    logger.info(
      `Started: ${this.houses.length} located house(s), ${this.inCoverage().length} in the Netherlands`,
    );
  }

  /** Gladys came back: everything it may have lost is published again. */
  async resync(config) {
    this.config = config;
    // The core keeps the connection status in memory only: send it again.
    this.lastStatus = undefined;
    this.gladys.forgetPublishedStates();
    await this.freshRefresh();
  }

  async reconfigure(config) {
    const languageChanged = config.language !== this.config.language;
    this.config = config;
    if (languageChanged) {
      // The text feature is written in the configured language.
      await this.publishStates({ force: true });
      await this.publishDiscovered();
      this.nudgeWidget();
    }
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = null;
    return Promise.resolve(this.running).then(() => this.store.flush());
  }

  schedule(delayMs) {
    if (!this.timers || this.stopped) {
      return;
    }
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.refresh().catch((err) => logger.error('Refresh failed', err));
    }, delayMs);
    this.timer.unref?.();
  }

  /** One refresh at a time: a second call waits for the one in progress. */
  refresh() {
    if (!this.running) {
      this.running = this.doRefresh().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  /**
   * A refresh that starts after this call (a scan, a reconnection): one in
   * progress may have read the houses or published before the request.
   */
  async freshRefresh() {
    if (this.running) {
      await this.running.catch(() => {});
    }
    return this.refresh();
  }

  async doRefresh() {
    let failed = false;
    try {
      failed = await this.readAndPublish();
    } finally {
      // Whatever happened, the next reading stays scheduled.
      this.schedule(failed ? this.timings.retryMs : this.nextDelay());
    }
  }

  /**
   * Milliseconds to the next reading: an hour, or just after the next block
   * boundary (04/10/16/22 Dutch time) when it comes sooner, so the current
   * advice and the triggers change with the block.
   */
  nextDelay() {
    const now = this.now().getTime();
    let delay = this.timings.refreshMs;
    for (const reading of this.readings.values()) {
      const end = reading.advice?.blocks.find((block) => block.end.getTime() > now)?.end;
      if (end) {
        delay = Math.min(delay, end.getTime() - now + this.timings.boundaryMarginMs);
      }
    }
    return Math.max(delay, this.timings.boundaryMarginMs);
  }

  /** One reading of every house; resolves true when a house failed. */
  async readAndPublish() {
    this.lastRefreshAt = this.now().getTime();
    await this.loadHouses();
    let tried = 0;
    let failures = 0;
    for (const house of this.houses) {
      if (!nearTheNetherlands(house.latitude, house.longitude)) {
        this.readings.set(house.selector, { outside: true });
        continue;
      }
      tried += 1;
      try {
        const advice = await fetchAdvice(this.fetch, toRdNew(house.latitude, house.longitude));
        this.readings.set(house.selector, { advice, at: this.now().getTime() });
        this.recovered(
          `house:${house.selector}`,
          `Stookwijzer advice of "${house.name}" read again`,
        );
      } catch (err) {
        if (err.kind === 'outside') {
          this.readings.set(house.selector, { outside: true });
          continue;
        }
        failures += 1;
        this.failed(
          `house:${house.selector}`,
          `Cannot read the Stookwijzer advice of "${house.name}": ${err.message}`,
        );
      }
    }
    await this.publishDiscovered();
    await this.publishStates();
    await this.fireTriggers();
    await this.publishStatus(tried > 0 && failures === tried);
    await this.store.save(this.data);
    this.nudgeWidget();
    logger.debug(`Refreshed ${this.houses.length} house(s)`);
    return failures > 0;
  }

  async loadHouses() {
    try {
      const houses = await this.gladys.getHouses();
      this.houses = houses
        .filter((house) => Number.isFinite(house.latitude) && Number.isFinite(house.longitude))
        .map(({ selector, name, latitude, longitude }) => ({
          selector,
          name,
          latitude,
          longitude,
        }));
      this.recovered('houses', 'Houses of Gladys read again');
    } catch (err) {
      // Keep the houses known so far.
      this.failed('houses', `Cannot read the houses of Gladys: ${err.message}`);
    }
  }

  /** Houses the Stookwijzer may cover (not known to be outside). */
  inCoverage() {
    return this.houses.filter((house) => !this.readings.get(house.selector)?.outside);
  }

  isCreated(externalId) {
    return (this.gladys.devices ?? []).some((device) => device.external_id === externalId);
  }

  async publishDiscovered() {
    const devices = this.inCoverage().map((house) =>
      buildDevice(this.gladys, house, this.config.language),
    );
    try {
      await this.gladys.publishDiscoveredDevices(devices);
      this.recovered('discovery', 'Devices published again');
    } catch (err) {
      this.failed('discovery', `Cannot publish the devices: ${err.message}`);
    }
  }

  /** What the widget and the states show for a house, or null without a reading. */
  view(selector) {
    const reading = this.readings.get(selector);
    if (!reading?.advice) {
      return reading?.outside ? { outside: true } : null;
    }
    if (this.now().getTime() - reading.at > this.timings.maxAgeMs) {
      return null;
    }
    const blocks = upcomingBlocks(reading.advice, this.now());
    return { advice: reading.advice, blocks, at: reading.at };
  }

  statesFor(house) {
    const view = this.view(house.selector);
    if (!view?.advice || view.blocks.length === 0) {
      return [];
    }
    return statesOf(
      houseIds(this.gladys, house.selector),
      view.advice,
      view.blocks,
      this.config.language,
    );
  }

  /**
   * Publishes the changed states of the created devices (the core drops the
   * states of a feature that does not exist yet).
   */
  async publishStates({ only = null, force = false } = {}) {
    const states = this.inCoverage()
      .filter((house) => (only ? house.selector === only : true))
      .filter((house) => this.isCreated(houseIds(this.gladys, house.selector).device))
      .flatMap((house) => this.statesFor(house));
    if (states.length === 0) {
      return;
    }
    if (force) {
      for (const house of this.inCoverage()) {
        this.gladys.forgetPublishedStates(houseIds(this.gladys, house.selector).device);
      }
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('states', 'States published again');
    } catch (err) {
      this.failed('states', `Cannot publish the states: ${err.message}`);
    }
  }

  /**
   * Scene events on the transitions of the current advice, and when a red
   * block is announced for certain (final advice of the next block). The
   * first reading of a house only sets the reference.
   */
  async fireTriggers() {
    for (const house of this.inCoverage()) {
      const view = this.view(house.selector);
      const current = view?.blocks?.[0];
      if (!current || current.code === null) {
        continue;
      }
      const ids = houseIds(this.gladys, house.selector);
      const before = this.data.houses[house.selector];
      const next = view.blocks[1];
      const announcedFor =
        current.code !== RED && next?.code === RED && next.final ? next.start.toISOString() : null;
      const events = [];
      if (before && Number.isInteger(before.code)) {
        if (before.code !== RED && current.code === RED) {
          events.push([TRIGGERS.RED, current]);
        } else if (before.code === RED && current.code !== RED) {
          events.push([TRIGGERS.RED_OVER, current]);
        }
        if (announcedFor && before.announced !== announcedFor) {
          events.push([TRIGGERS.RED_ANNOUNCED, next]);
        }
      }
      const reference = {
        code: current.code,
        announced: announcedFor ?? before?.announced ?? null,
      };
      if (this.isCreated(ids.device)) {
        for (const [key, block] of events) {
          const failure = `event:${house.selector}:${key}`;
          try {
            await this.gladys.publishSceneEvent(key, this.eventData(key, ids, view.advice, block));
            this.recovered(failure, `${house.name}: ${key} fired at last`);
            logger.info(`${house.name}: ${key}`);
          } catch (err) {
            // Keep the previous reference: the transition is seen, and the
            // event sent, again at the next reading.
            if (key === TRIGGERS.RED_ANNOUNCED) {
              reference.announced = before.announced;
            } else {
              reference.code = before.code;
            }
            this.failed(failure, `Cannot fire ${key} for "${house.name}": ${err.message}`);
          }
        }
      }
      this.data.houses[house.selector] = reference;
    }
  }

  eventData(key, ids, advice, block) {
    return {
      house: ids.device,
      // Only "code red is over" filters on the new advice: red otherwise.
      ...(key === TRIGGERS.RED_OVER ? { advice: CODES[block.code] } : {}),
      advice_text: adviceSentence(this.config.language, CODES[block.code]),
      starts_at: formatHour(block.start),
      ends_at: formatHour(block.end),
      postcode: advice.postcode,
      wind_force: advice.windBft,
      lki: advice.lki,
    };
  }

  async publishStatus(allFailed) {
    let status;
    if (this.houses.length === 0) {
      status = [false, render(STATUS, 'noHouse')];
    } else if (this.inCoverage().length === 0) {
      status = [false, render(STATUS, 'outside')];
    } else if (allFailed) {
      status = [false, render(STATUS, 'down')];
    } else {
      status = [true];
    }
    const key = JSON.stringify(status);
    if (key === this.lastStatus) {
      return;
    }
    try {
      await this.gladys.setConnectionStatus(...status);
      this.lastStatus = key;
    } catch (err) {
      logger.debug(`Cannot set the connection status: ${err.message}`);
    }
  }

  // --- Events of Gladys -------------------------------------------------------

  async onDeviceCreated(device) {
    const selector = selectorOfId(this.gladys, device?.external_id);
    if (!selector) {
      return;
    }
    // Everything again: the SDK forgot the states of this device.
    this.gladys.forgetPublishedStates(device.external_id);
    await this.publishStates({ only: selector });
    this.nudgeWidget();
  }

  async onDeviceDeleted() {
    this.nudgeWidget();
  }

  /** Fallback for a Gladys that would poll anyway: read again if stale. */
  async poll(device) {
    const selector = selectorOfId(this.gladys, device?.external_id);
    if (!selector) {
      return;
    }
    if (this.now().getTime() - this.lastRefreshAt >= this.timings.refreshMs / 2) {
      await this.refresh();
    } else {
      await this.publishStates({ only: selector });
    }
  }

  /** "Re-pull me now" (synchronous, rate-limited by the SDK). */
  nudgeWidget() {
    try {
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } catch (err) {
      logger.debug(`Cannot ask the widget to refresh: ${err.message}`);
    }
  }

  // --- Quiet logs -------------------------------------------------------------

  failed(key, message) {
    if (this.failures.has(key)) {
      logger.debug(message);
      return;
    }
    this.failures.set(key, true);
    logger.warn(message);
  }

  recovered(key, message) {
    if (this.failures.delete(key)) {
      logger.info(message);
    }
  }
}
