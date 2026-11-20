// -----------------------------------------------------------------------------
// When the integration asks aWATTar again, and who drives it: the
// container's own timer (Gladys#3198: the core may never call onPoll), the
// core's onPoll only as a fallback.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp } from '../src/app.js';
import { buildDevice } from '../src/device.js';
import { normalizeConfig } from '../src/config.js';
import { FEATURE } from '../src/device.js';
import { createFakeApi, createWorld, FIXTURES_END, last } from './helpers/world.js';

const MINUTE = 60 * 1000;

/** Run one cycle a minute from the current clock, for `minutes`. */
async function runFor(world, minutes) {
  for (let i = 0; i < minutes; i += 1) {
    world.clock.advance(MINUTE);
    await world.app.cycle();
  }
}

const TOMORROW_START = Date.parse('2026-10-24T22:00:00Z'); // 25 October 00:00

test('in the morning: one request for today and tomorrow, an hour', async () => {
  const world = await createWorld({ at: '2026-10-24T06:00:00Z' }); // 08:00
  assert.equal(world.api.count(), 1);
  await runFor(world, 59);
  assert.equal(world.api.count(), 1);
  await runFor(world, 1);
  assert.equal(world.api.count(), 2);
  // A GET from 23:00 the day before to the day after tomorrow 00:00.
  const [first] = world.api.requests;
  assert.equal(
    first.url,
    'https://api.awattar.de/v1/marketdata?start=1792789200000&end=1792969200000',
  );
  assert.equal(first.end, FIXTURES_END);
  assert.equal(first.init.method, undefined, 'GET');
});

test("from 13:00, every 15 minutes until tomorrow's prices are out, then hourly again", async () => {
  const world = await createWorld({ at: '2026-10-24T10:50:00Z', publishedUntil: TOMORROW_START });
  const nudges = world.gladys.fake.widgetRefreshes.length;
  await runFor(world, 10); // 13:00: hourly not due yet, the 15-minute rule waits for 13:05
  assert.equal(world.api.count(), 1);
  await runFor(world, 5); // 13:05
  assert.equal(world.api.count(), 2);
  await runFor(world, 15); // 13:20
  assert.equal(world.api.count(), 3);
  assert.equal(world.gladys.fake.widgetRefreshes.length, nudges, 'nothing new, no widget nudge');

  world.api.publishedUntil = FIXTURES_END; // published
  await runFor(world, 15); // 13:35
  assert.equal(world.api.count(), 4);
  assert.equal(world.gladys.fake.widgetRefreshes.length, nudges + 1, 'new prices nudge the widget');
  await runFor(world, 59);
  assert.equal(world.api.count(), 4, 'hourly again');
  await runFor(world, 1);
  assert.equal(world.api.count(), 5);
});

test('a day without tomorrow stays under the fair use of 100 requests', async () => {
  const world = await createWorld({ at: '2026-10-23T22:00:30Z', publishedUntil: TOMORROW_START });
  await runFor(world, 24 * 60 - 2);
  assert.ok(world.api.count() <= 60, `${world.api.count()} requests`);
});

test('an error of the API is a failure, and the action says it in red', async () => {
  const world = await createWorld({ connect: false });
  world.api.failure = { status: 500, body: { error: { message: 'boom' } } };
  await world.gladys.connect();
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.equal(last(world.gladys, FEATURE.PRICE_NOW), undefined);
  const ack = await world.gladys.fake.action('refresh');
  assert.equal(ack.success, false);
  assert.match(ack.error.fr, /aWATTar est injoignable \(aWATTar answered HTTP 500: boom\)/);
});

test('a failure keeps the known prices and retries after 5, 10, 20 minutes', async () => {
  const world = await createWorld();
  const price = last(world.gladys, FEATURE.PRICE_NOW);
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });

  world.api.down = true;
  await runFor(world, 60);
  const attempts = () => world.api.count();
  assert.equal(attempts(), 2);
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.match(world.gladys.fake.connectionStatus.message.en, /last known prices/);
  await runFor(world, 4);
  assert.equal(attempts(), 2);
  await runFor(world, 1);
  assert.equal(attempts(), 3);
  await runFor(world, 10);
  assert.equal(attempts(), 4);
  // The hour changed meanwhile: the current price follows the known data.
  assert.notEqual(last(world.gladys, FEATURE.PRICE_NOW), price);
  assert.equal(last(world.gladys, FEATURE.PRICE_NOW), 0.01302);

  world.api.down = false;
  await runFor(world, 20);
  assert.equal(attempts(), 5);
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
  // The status is sent on a change only.
  assert.equal(world.gladys.fake.connectionStatuses.length, 3);
});

test('a new day without its prices asks again every 15 minutes, not hourly', async () => {
  // 23:50: tomorrow not published yet, and it stays so past midnight.
  const world = await createWorld({ at: '2026-10-24T21:50:00Z', publishedUntil: TOMORROW_START });
  await runFor(world, 11); // 00:01: the 25th has begun without a price
  assert.equal(last(world.gladys, FEATURE.PRICE_NOW), 0.01605, 'the last hour of the 24th');
  await runFor(world, 4); // 00:05, 15 minutes after the last request
  assert.equal(world.api.count(), 2);
  assert.equal(world.gladys.fake.connectionStatus.connected, false);
  assert.match(world.gladys.fake.connectionStatus.message.en, /no price for today/);
  world.api.publishedUntil = FIXTURES_END; // published at last
  await runFor(world, 15); // 00:20
  assert.equal(world.api.count(), 3);
  assert.equal(last(world.gladys, FEATURE.PRICE_NOW), 0.00898);
  assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
});

test('the "Refresh now" action reads aWATTar and reports what it got', async () => {
  const world = await createWorld();
  const ack = await world.gladys.fake.action('refresh');
  assert.equal(ack.success, true);
  assert.equal(world.api.count(), 2);
  // 25 hours tomorrow: the clocks go back.
  assert.match(ack.data.message.en, /24 hours today, 25 hours tomorrow/);
  assert.match(ack.data.message.fr, /Prix actuel : 0,035 €\/kWh \(marché : 0,029 €\/kWh HT\)/);

  world.api.down = true;
  const failed = await world.gladys.fake.action('refresh');
  assert.equal(failed.success, false);
  assert.match(failed.error.de, /nicht erreichbar \(aWATTar unreachable \(ENOTFOUND\)\)/);
  assert.match(failed.error.es, /No se puede acceder a aWATTar/);
});

test('the states refresh on the container timer alone, without onPoll', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: new Date('2026-10-24T08:58:00Z') });
  const api = createFakeApi();
  const gladys = createFakeGladys({});
  gladys.fake.devices = [buildDevice(gladys, normalizeConfig())];
  t.mock.method(gladys, 'onPoll', () => {});
  const app = createApp(gladys, {
    fetch: api.fetch,
    dataDir: mkdtempSync(join(tmpdir(), 'gladys-awattar-')),
  });
  await gladys.connect();
  assert.equal(last(gladys, FEATURE.PRICE_NOW), 0.03459); // 10:00-11:00

  // Two minutes later, 11:00 in Berlin: the timer alone moves the price.
  for (let i = 0; i < 3; i += 1) {
    t.mock.timers.tick(MINUTE);
    for (let j = 0; j < 20; j += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
  assert.equal(last(gladys, FEATURE.PRICE_NOW), 0.01302);
  assert.equal(gladys.onPoll.mock.callCount(), 1, 'replaced by a mock: the core could not call it');
  app.stop();
});

test("the core's onPoll runs a cycle only when the timer missed one", async () => {
  const world = await createWorld();
  const device = world.gladys.fake.discoveredDevices[0];
  const before = world.api.requests.length;
  world.clock.advance(MINUTE);
  assert.deepEqual(await world.gladys.fake.poll(device), { success: true });
  // A minute after the last cycle: skipped (it would not read anything anyway).
  world.clock.advance(61 * MINUTE);
  assert.deepEqual(await world.gladys.fake.poll(device), { success: true });
  assert.equal(world.api.requests.length, before + 1, 'the stalled timer is replaced');
});
