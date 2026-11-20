// -----------------------------------------------------------------------------
// The device and its states, built from the real fixtures through the whole
// wiring (fake Gladys + fake aWATTar API).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FEATURE } from '../src/device.js';
import { createWorld, DAY_TIME, last } from './helpers/world.js';

test('one device, built on the country, with French names by default', async () => {
  const { gladys } = await createWorld();
  const [device] = gladys.fake.discoveredDevices;
  assert.equal(device.name, 'aWATTar Deutschland');
  assert.equal(device.external_id, 'ext:test-integration:prices:de');
  assert.deepEqual(
    device.features.map((f) => f.external_id.split(':').at(-1)),
    Object.values(FEATURE),
  );
  const names = Object.fromEntries(
    device.features.map((f) => [f.external_id.split(':').at(-1), f.name]),
  );
  assert.equal(names.price_now, 'Prix actuel (€/kWh)');
  assert.equal(names.market_price_now, 'Prix du marché actuel (€/kWh HT)');
  for (const feature of device.features) {
    assert.equal(feature.read_only, true, `${feature.name} is a sensor`);
  }
});

test('the states at 10:30 on 24 October 2026 in Germany, VAT included', async () => {
  const { gladys } = await createWorld({ at: DAY_TIME });
  // 10:00-11:00: 29.07 €/MWh, x 1.19.
  assert.equal(last(gladys, FEATURE.MARKET_PRICE_NOW), 0.02907);
  assert.equal(last(gladys, FEATURE.PRICE_NOW), 0.03459);
  assert.equal(last(gladys, FEATURE.PRICE_NEXT), 0.01302); // 10.94 €/MWh
  assert.equal(last(gladys, FEATURE.PRICE_AVG_TODAY), 0.03585);
  assert.equal(last(gladys, FEATURE.PRICE_MIN_TODAY), 0.00007); // 14:00, 0.06 €/MWh
  assert.equal(last(gladys, FEATURE.PRICE_MAX_TODAY), 0.11776); // 19:00, 98.96 €/MWh
  assert.equal(last(gladys, FEATURE.CHEAPEST_HOUR_TODAY), '14:00');
  assert.equal(last(gladys, FEATURE.PRICIEST_HOUR_TODAY), '19:00');
  assert.equal(last(gladys, FEATURE.PRICE_RANK_NOW), 16);
});

test('Austria: its own device, market and tariff (+ 1.5 ct, 20 % VAT)', async () => {
  const { gladys, api } = await createWorld({ config: { country: 'at' } });
  assert.match(api.requests[0].url, /^https:\/\/api\.awattar\.at\/v1\/marketdata\?/);
  const [device] = gladys.fake.discoveredDevices;
  assert.equal(device.name, 'aWATTar Österreich');
  assert.equal(device.external_id, 'ext:test-integration:prices:at');
  // 10:00-11:00: 236.68 €/MWh -> (0.23668 + 0.015) x 1.2.
  assert.equal(last(gladys, FEATURE.MARKET_PRICE_NOW, 'at'), 0.23668);
  assert.equal(last(gladys, FEATURE.PRICE_NOW, 'at'), 0.30202);
  assert.equal(last(gladys, FEATURE.CHEAPEST_HOUR_TODAY, 'at'), '13:00');
});

test('a changed tariff republishes every value, the device keeps its id', async () => {
  const { gladys } = await createWorld();
  const id = gladys.fake.discoveredDevices[0].external_id;
  const before = gladys.fake.states.length;
  await gladys.fake.configUpdated({ include_vat: false, surcharge: '20' });
  assert.equal(gladys.fake.discoveredDevices[0].external_id, id);
  assert.equal(last(gladys, FEATURE.PRICE_NOW), 0.22907);
  // The hours of the minimum did not change, they are sent again anyway.
  assert.equal(gladys.fake.states.length - before, 9);
});

test('another country reads its market at once, as another device', async () => {
  const world = await createWorld();
  await world.gladys.fake.configUpdated({ country: 'at' });
  assert.equal(world.api.requests.at(-1).country, 'at');
  assert.equal(
    world.gladys.fake.discoveredDevices[0].external_id,
    'ext:test-integration:prices:at',
  );
  // The German device, still the one added, receives no Austrian price.
  assert.equal(last(world.gladys, FEATURE.PRICE_NOW, 'at'), undefined);
  assert.equal(last(world.gladys, FEATURE.PRICE_NOW), 0.03459);
  const ack = await world.gladys.fake.widgetGet('prices', { language: 'en' });
  assert.equal(ack.data.content.components[1].value, 0.302, 'the widget shows Austria');
});

test('nothing is published before the user adds the device, everything once added', async () => {
  const { gladys } = await createWorld({ created: false });
  assert.equal(gladys.fake.states.length, 0);
  await gladys.fake.deviceCreated(gladys.fake.discoveredDevices[0]);
  assert.equal(gladys.fake.states.length, 9);
  assert.ok(gladys.fake.widgetRefreshes.length > 0, 'the widget is nudged');
});

test('an unchanged value is not sent again within the hour', async () => {
  const { gladys, app, clock } = await createWorld();
  const before = gladys.fake.states.length;
  clock.advance(60 * 1000);
  await app.cycle();
  assert.equal(gladys.fake.states.length, before);
  // The next hour: the current and next prices and the rank move.
  clock.set('2026-10-24T09:00:30Z');
  await app.cycle();
  const ids = gladys.fake.states
    .slice(before)
    .map((s) => s.device_feature_external_id.split(':').at(-1));
  assert.deepEqual(ids.sort(), ['market_price_now', 'price_next', 'price_now', 'price_rank_now']);
});

test("at 23:30 the next hour is tomorrow's, when it is published", async () => {
  const late = '2026-10-24T21:30:00Z';
  const { gladys } = await createWorld({ at: late });
  assert.equal(last(gladys, FEATURE.PRICE_NEXT), 0.00898); // 7.55 €/MWh

  const early = await createWorld({ at: late, publishedUntil: Date.parse('2026-10-24T22:00:00Z') });
  assert.equal(last(early.gladys, FEATURE.PRICE_NEXT), undefined);
  assert.equal(last(early.gladys, FEATURE.PRICE_NOW), 0.01605); // 13.49 €/MWh
});
