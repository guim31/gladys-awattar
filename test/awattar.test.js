// -----------------------------------------------------------------------------
// The aWATTar client, against real answers of the API (recorded on 20
// November 2026) and a fake fetch: never the network.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { API_URLS, AwattarError, fetchMarketData, parseMarketData } from '../src/awattar.js';
import { slotsOfDay } from '../src/prices.js';
import { FIXTURES } from './helpers/world.js';

const today = JSON.parse(
  readFileSync(new URL('./fixtures/awattar/de-2026-11-20.json', import.meta.url), 'utf8'),
);

test('a day of hourly market prices, in EUR/kWh', () => {
  const slots = parseMarketData(today);
  assert.equal(slots.length, 24);
  assert.equal(slots[0].start.toISOString(), '2026-11-19T23:00:00.000Z');
  assert.equal(slots[0].end.toISOString(), '2026-11-20T00:00:00.000Z');
  assert.equal(slots[0].market, today.data[0].marketprice / 1000);
});

test('the day the clocks go back has 25 hours, both countries', () => {
  for (const country of ['de', 'at']) {
    const slots = parseMarketData(FIXTURES[country]);
    assert.equal(slots.length, 73, country);
    assert.equal(slotsOfDay(slots, '2026-10-25').length, 25, country);
    assert.equal(slotsOfDay(slots, '2026-10-24').length, 24, country);
  }
});

test('not published yet: an empty list, no error', () => {
  assert.deepEqual(parseMarketData(FIXTURES.notPublished), []);
});

test('quarter-hours are averaged back to the hour, malformed entries skipped', () => {
  const base = Date.parse('2026-11-20T10:00:00Z');
  const quarter = (index, price) => ({
    start_timestamp: base + index * 900000,
    end_timestamp: base + (index + 1) * 900000,
    marketprice: price,
    unit: 'Eur/MWh',
  });
  const slots = parseMarketData({
    data: [
      quarter(0, 100),
      quarter(1, 120),
      quarter(2, 80),
      quarter(3, 100),
      { start_timestamp: base + 3600000, end_timestamp: base, marketprice: 1 },
      { ...quarter(4, 'n/a') },
      { ...quarter(5, 1), unit: 'USD/MWh' },
    ],
  });
  assert.equal(slots.length, 1);
  assert.equal(slots[0].market, 0.1);
  assert.throws(() => parseMarketData({ error: {} }), AwattarError);
});

test('the request: the country, the range, a User-Agent, no key', async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return Response.json(FIXTURES.notPublished);
  };
  await fetchMarketData({ country: 'at', start: 1, end: 2, fetch });
  assert.equal(calls[0].url, `${API_URLS.at}?start=1&end=2`);
  assert.match(calls[0].init.headers['User-Agent'], /gladys-awattar/);
});

test('the failures say what happened', async () => {
  const answer = (status, body) => async () => Response.json(body, { status });
  await assert.rejects(
    fetchMarketData({ country: 'de', start: 0, end: 1, fetch: answer(500, FIXTURES.invalidDate) }),
    {
      kind: 'http',
      status: 500,
      message: 'aWATTar answered HTTP 500: "value" must be a valid date',
    },
  );
  await assert.rejects(
    fetchMarketData({ country: 'de', start: 0, end: 1, fetch: answer(429, {}) }),
    { kind: 'http', status: 429, message: 'aWATTar answered HTTP 429' },
  );
  await assert.rejects(
    fetchMarketData({
      country: 'de',
      start: 0,
      end: 1,
      fetch: async () => new Response('<html>', { status: 200 }),
    }),
    { kind: 'format' },
  );
  await assert.rejects(
    fetchMarketData({
      country: 'de',
      start: 0,
      end: 1,
      fetch: async () => {
        throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
      },
    }),
    { kind: 'network', message: 'aWATTar unreachable (ECONNREFUSED)' },
  );
});
