// -----------------------------------------------------------------------------
// The scene triggers: which events go out when an hour begins, once.
// Real German prices of 24 and 25 October 2026, VAT included.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarketData } from '../src/awattar.js';
import { normalizeConfig, tariffPrice } from '../src/config.js';
import { slotsOfDay } from '../src/prices.js';
import { eventsForSlot, TRIGGER } from '../src/triggers.js';
import { createWorld, FIXTURES } from './helpers/world.js';

const config = normalizeConfig();
const all = parseMarketData(FIXTURES.de).map((slot) => ({
  ...slot,
  price: tariffPrice(slot.market, config),
}));
const day = slotsOfDay(all, '2026-10-24');
const at = (hour) => day[hour]; // the slot starting at hour:00 in Berlin
const summary = (events) => events.map((e) => `${e.key}:${e.data.hours ?? e.data.threshold}`);

test('14:00, the cheapest hour of 24 October: every "N cheapest hours"', () => {
  const events = eventsForSlot(day, at(14), all);
  assert.deepEqual(summary(events), [
    'cheapest_window_started:1',
    'cheap_hour_started:1',
    'cheap_hour_started:2',
    'cheap_hour_started:3',
    'cheap_hour_started:4',
    'cheap_hour_started:5',
    'cheap_hour_started:6',
    'cheap_hour_started:8',
    'cheap_hour_started:10',
    'cheap_hour_started:12',
  ]);
  assert.deepEqual(events[0].data, {
    hours: '1',
    average_price: 0.00007,
    start_time: '14:00',
    end_time: '15:00',
  });
  assert.deepEqual(events[1].data, {
    hours: '1',
    rank: 1,
    price: 0.00007,
    start_time: '14:00',
    end_time: '15:00',
  });
});

test('the longer windows begin earlier, around the sunny afternoon', () => {
  const started = (hour) =>
    eventsForSlot(day, at(hour), all)
      .filter((e) => e.key === TRIGGER.CHEAPEST_WINDOW)
      .map((e) => Number(e.data.hours));
  const byHour = Object.fromEntries(
    day.map((_, hour) => [hour, started(hour)]).filter(([, list]) => list.length > 0),
  );
  // Each N begins exactly once a day.
  assert.deepEqual(byHour, { 9: [8], 11: [5, 6], 12: [3, 4], 13: [2], 14: [1] });
  const six = eventsForSlot(day, at(11), all).find((e) => e.data.hours === '6');
  assert.equal(six.data.start_time, '11:00');
  assert.equal(six.data.end_time, '17:00');
});

test('the price drops below a threshold: once per cheap run, with its end', () => {
  const drops = (slots, slot) =>
    eventsForSlot(slots, slot, all)
      .filter((e) => e.key === TRIGGER.PRICE_BELOW)
      .map((e) => `${e.data.threshold}<${e.data.end_time}`);
  // 10:00: 3.46 ct after 5.16 ct, below 5 ct until 17:00.
  assert.deepEqual(drops(day, at(10)), ['5<17:00']);
  assert.deepEqual(drops(day, at(11)), [], 'still below: no new drop');
  // 25 October, 04:00 (the second hour after the clocks went back is 03:00):
  // -0.01 €/MWh after 0, a negative price until 05:00.
  const sunday = slotsOfDay(all, '2026-10-25');
  const negative = sunday.find((slot) => slot.market < 0);
  const [event] = eventsForSlot(sunday, negative, all).filter((e) => e.key === TRIGGER.PRICE_BELOW);
  assert.deepEqual(event.data, {
    threshold: '0',
    price: -0.00001,
    start_time: '04:00',
    end_time: '05:00',
  });
  // The first hour known has no hour before: no drop seen, nothing fires.
  assert.deepEqual(drops(day, at(0)), []);
});

test('19:00, the most expensive hour, fires nothing', () => {
  assert.deepEqual(eventsForSlot(day, at(19), all), []);
  // A slot of another day is never compared with this one.
  assert.deepEqual(eventsForSlot(day.slice(1), at(0), all), []);
});

test('each N cheapest hours fires exactly N times a day', () => {
  const counts = {};
  for (const slot of day) {
    for (const event of eventsForSlot(day, slot, all)) {
      if (event.key === TRIGGER.CHEAP_HOUR) {
        counts[event.data.hours] = (counts[event.data.hours] ?? 0) + 1;
      }
    }
  }
  assert.deepEqual(counts, { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 8: 8, 10: 10, 12: 12 });
});

test('the events go out when the hour begins, once, even across a restart', async () => {
  const world = await createWorld({ at: '2026-10-24T11:59:30Z' }); // 13:59:30
  const before = world.gladys.fake.sceneEvents.length;
  world.clock.set('2026-10-24T12:00:02Z');
  await world.app.cycle();
  const fired = world.gladys.fake.sceneEvents.length - before;
  assert.equal(fired, 10);
  world.clock.set('2026-10-24T12:01:02Z');
  await world.app.cycle();
  assert.equal(world.gladys.fake.sceneEvents.length - before, 10, 'once');

  // The container restarts at 14:02 with the same /data: nothing again.
  const restarted = await createWorld({ at: '2026-10-24T12:02:00Z', dataDir: world.dataDir });
  assert.equal(restarted.gladys.fake.sceneEvents.length, 0);
});

test('a drop at midnight is seen: the refresh of the new day keeps the hour before', async () => {
  // + 3 ct: 23:00 costs 5.17 ct, 00:00 4.47 ct (13.49 then 7.55 €/MWh).
  const world = await createWorld({ at: '2026-10-24T21:00:01Z', config: { surcharge: '3' } });
  const before = world.api.count();
  world.clock.set('2026-10-24T22:00:02Z'); // 00:00:02, the hourly refresh is due
  await world.app.cycle();
  assert.equal(world.api.count(), before + 1);
  assert.equal(world.api.requests.at(-1).start, Date.parse('2026-10-24T21:00:00Z'));
  const drops = world.gladys.fake.sceneEvents.filter((e) => e.key === TRIGGER.PRICE_BELOW);
  assert.deepEqual(
    drops.map((e) => [e.data.threshold, e.data.start_time]),
    [['5', '00:00']],
  );
});

test('an hour that began more than 10 minutes ago fires nothing', async () => {
  const world = await createWorld({ at: '2026-10-24T12:11:00Z' }); // 14:11
  assert.deepEqual(world.gladys.fake.sceneEvents, []);
  const onTime = await createWorld({ at: '2026-10-24T12:09:00Z' });
  assert.equal(onTime.gladys.fake.sceneEvents.length, 10);
});

test('a refused event is sent again on the next cycle, the others are not duplicated', async (t) => {
  const world = await createWorld({ at: '2026-10-24T11:59:30Z' });
  const original = world.gladys.publishSceneEvent.bind(world.gladys);
  let calls = 0;
  t.mock.method(world.gladys, 'publishSceneEvent', async (key, data) => {
    calls += 1;
    if (calls === 3) {
      throw new Error('429 TOO_MANY_REQUESTS');
    }
    return original(key, data);
  });
  world.clock.set('2026-10-24T12:00:02Z');
  await world.app.cycle();
  assert.equal(world.gladys.fake.sceneEvents.length, 2);
  world.clock.set('2026-10-24T12:01:02Z');
  await world.app.cycle();
  const sent = world.gladys.fake.sceneEvents.map((e) => `${e.key}:${e.data.hours}`);
  assert.equal(sent.length, 10);
  assert.equal(new Set(sent).size, 10);
});
