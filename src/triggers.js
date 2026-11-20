// -----------------------------------------------------------------------------
// Scene triggers (manifest `scene_triggers`, Gladys 5.1+).
//
// What the device states cannot say: "it starts NOW". The rank of the current
// hour is a state (a scene can wait for "rank ≤ 4" with the core's own
// threshold), but the start of the cheapest 3-hour window of the day — the
// moment to start a dishwasher once — is an event.
//
//   cheapest_window_started  the cheapest run of N consecutive hours of the
//                            day begins (N = 1 is the cheapest hour);
//   cheap_hour_started       one of the N cheapest hours of the day begins
//                            (they may be apart: a boiler, a car charger).
//
// The core filters scene events on equality and membership only, so the
// scene author picks N in a required `hours` select, and the integration
// fires one event per N that matches the hour: at the start of the
// third-cheapest hour, `cheap_hour_started` goes out with hours = "3", "4",
// "5"... A scene listening for "4 cheapest hours" thus runs once, at the
// start of each of these hours. At most 17 events an hour, far from the 300
// per minute of the core.
//
//   price_dropped_below      the price of the hour beginning is below N
//                            ct/kWh, and the hour before was not (an
//                            unknown hour before fires nothing: no drop
//                            seen): once per cheap run, with the time
//                            the run ends. The core's own threshold on the
//                            "Current price" state cannot tell when the run
//                            ends, and needs the device added.
//
// The prices compared are the configured ones (aWATTar HOURLY price, with or
// without VAT).
// -----------------------------------------------------------------------------

import { cheapestWindow, rankOf, roundPrice } from './prices.js';
import { marketTime } from './time.js';

export const TRIGGER = {
  CHEAPEST_WINDOW: 'cheapest_window_started',
  CHEAP_HOUR: 'cheap_hour_started',
  PRICE_BELOW: 'price_dropped_below',
};

/** The N the scene author can pick, as declared in the manifest options. */
export const WINDOW_HOURS = [1, 2, 3, 4, 5, 6, 8];
export const CHEAP_HOURS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
/** ct/kWh. */
export const THRESHOLDS = [0, 5, 10, 15, 20, 25, 30, 35, 40];

/**
 * The scene events to fire when `slot` begins.
 * @param {Array} daySlots the slots of the market day of `slot`
 * @param {{ start: Date, end: Date, price: number }} slot
 * @param {Array} [slots] every known slot (the hour before, the hours after)
 * @returns {Array<{ key: string, data: object }>}
 */
export function eventsForSlot(daySlots, slot, slots = daySlots) {
  if (!daySlots.includes(slot)) {
    return [];
  }
  const events = [];

  for (const hours of WINDOW_HOURS) {
    const window = cheapestWindow(daySlots, hours);
    if (window && window.start.getTime() === slot.start.getTime()) {
      events.push({
        key: TRIGGER.CHEAPEST_WINDOW,
        data: {
          hours: String(hours),
          average_price: roundPrice(window.average),
          start_time: marketTime(window.start),
          end_time: marketTime(window.end),
        },
      });
    }
  }

  const rank = rankOf(daySlots, slot);
  for (const hours of CHEAP_HOURS) {
    if (rank <= hours) {
      events.push({
        key: TRIGGER.CHEAP_HOUR,
        data: {
          hours: String(hours),
          rank,
          price: roundPrice(slot.price),
          start_time: marketTime(slot.start),
          end_time: marketTime(slot.end),
        },
      });
    }
  }

  const previous = slots.find((other) => other.end.getTime() === slot.start.getTime());
  for (const threshold of THRESHOLDS) {
    const limit = threshold / 100;
    if (previous && slot.price < limit && previous.price >= limit) {
      events.push({
        key: TRIGGER.PRICE_BELOW,
        data: {
          threshold: String(threshold),
          price: roundPrice(slot.price),
          start_time: marketTime(slot.start),
          end_time: marketTime(cheapRunEnd(slots, slot, limit)),
        },
      });
    }
  }
  return events;
}

/**
 * When the run of hours below `limit` that `slot` begins ends, as far as the
 * known prices tell.
 * @param {Array} slots
 * @param {{ end: Date }} slot
 * @param {number} limit
 */
function cheapRunEnd(slots, slot, limit) {
  let end = slot.end;
  for (;;) {
    const next = slots.find((other) => other.start.getTime() === end.getTime());
    if (!next || next.price >= limit) {
      return end;
    }
    end = next.end;
  }
}
