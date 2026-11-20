// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake aWATTar API serving
// the real fixtures, a settable clock and a temporary /data, with the
// integration wired on top through createApp — the very wiring index.js uses.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp } from '../../src/app.js';

// The integration logs its lifecycle; keep the test output readable
// (LOG_LEVEL is read on every log call). LOG_LEVEL=debug npm test shows them.
process.env.LOG_LEVEL ??= 'silent';

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/awattar/${name}`, import.meta.url), 'utf8'));

export const TODAY = '2026-10-24';
// The day the clocks go back: 25 hours.
export const TOMORROW = '2026-10-25';

export const FIXTURES = {
  // Real answers of api.awattar.de and api.awattar.at, 24 to 26 October 2026.
  de: fixture('de-2026-10-24-to-26.json'),
  at: fixture('at-2026-10-24-to-26.json'),
  notPublished: fixture('not-published.json'),
  invalidDate: fixture('invalid-date.json'),
};

/** 24 October 2026, 10:30 in Berlin (CEST, UTC+2). */
export const DAY_TIME = '2026-10-24T08:30:00Z';

/** 00:00 of 26 October in Berlin (CET): the end of the fixtures. */
export const FIXTURES_END = Date.parse('2026-10-25T23:00:00Z');

/**
 * A fake aWATTar API serving the real fixtures of the asked range. Hours
 * from `publishedUntil` (ms) on are "not published yet": missing, like the
 * real API. `down` makes every request fail like an unreachable host;
 * `failure` answers `{ status, body }` instead.
 */
export function createFakeApi() {
  const api = {
    publishedUntil: FIXTURES_END,
    down: false,
    failure: null,
    requests: [],
    async fetch(url, init) {
      const parsed = new URL(String(url));
      const start = Number(parsed.searchParams.get('start'));
      const end = Number(parsed.searchParams.get('end'));
      const country = parsed.hostname.endsWith('.at') ? 'at' : 'de';
      api.requests.push({ url: String(url), init, start, end, country });
      if (api.down) {
        throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
      }
      if (api.failure) {
        return Response.json(api.failure.body, { status: api.failure.status });
      }
      const data = FIXTURES[country].data.filter(
        (entry) =>
          entry.start_timestamp >= start &&
          entry.start_timestamp < end &&
          entry.end_timestamp <= api.publishedUntil,
      );
      return Response.json({ object: 'list', data, url: `/${country}/v1/marketdata` });
    },
    count() {
      return api.requests.length;
    },
  };
  return api;
}

/** A clock the test moves by hand. */
export function createClock(iso = DAY_TIME) {
  let current = new Date(iso).getTime();
  return {
    now: () => current,
    set(next) {
      current = new Date(next).getTime();
    },
    advance(ms) {
      current += ms;
    },
  };
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {boolean} [options.created] the user already added the device
 * @param {number} [options.publishedUntil] see createFakeApi
 * @param {string} [options.at] the clock, ISO
 * @param {boolean} [options.connect]
 * @param {string} [options.dataDir]
 */
export async function createWorld({
  config = {},
  created = true,
  publishedUntil = FIXTURES_END,
  at = DAY_TIME,
  connect = true,
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-awattar-')),
} = {}) {
  const api = createFakeApi();
  api.publishedUntil = publishedUntil;
  const clock = createClock(at);
  const gladys = createFakeGladys({ config });
  const app = createApp(gladys, { fetch: api.fetch, now: clock.now, timers: false, dataDir });
  const world = { gladys, api, clock, app, dataDir };
  if (created) {
    // The device as the user added it, before the integration connects.
    const { buildDevice } = await import('../../src/device.js');
    const { normalizeConfig } = await import('../../src/config.js');
    gladys.fake.devices = [buildDevice(gladys, normalizeConfig(config))];
  }
  if (connect) {
    await gladys.connect();
  }
  return world;
}

/** External id of a feature of the aWATTar device. */
export const featureId = (gladys, key, country = 'de') =>
  gladys.externalIds('prices', country).feature(key);

/** The last state of a feature: a number, or the text of a text feature. */
export function last(gladys, key, country = 'de') {
  const id = featureId(gladys, key, country);
  const states = gladys.fake.states.filter((s) => s.device_feature_external_id === id);
  const state = states.at(-1);
  return state === undefined ? undefined : (state.text ?? state.state);
}
