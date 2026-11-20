// -----------------------------------------------------------------------------
// The prices the integration knows, and when to ask aWATTar again.
//
// One request per refresh, from yesterday 23:00 to the day after tomorrow 00:00
// (Central European Time): today's hours, and tomorrow's once published.
// aWATTar asks for fair use (100 requests a day at most); the refresh policy
// keeps far below:
//   - once an hour (24 requests a day);
//   - every 15 minutes from 13:00 while tomorrow's prices are missing:
//     aWATTar publishes them around 14:00, and the scenes and the widget want
//     them soon after (a few more requests, about 60 a day at worst);
//   - every 15 minutes too while today's prices are missing;
//   - after a failure, again after 5, 10, 20, 40 then 60 minutes.
// The data of the last successful refresh stays in use while a refresh
// fails: prices are known a day ahead, an hour without the API changes
// nothing for the current price.
// -----------------------------------------------------------------------------

import { fetchMarketData } from './awattar.js';
import { tariffPrice } from './config.js';
import { rankOf, slotAfter, slotAt, slotsOfDay, summarize } from './prices.js';
import { addDays, dayStart, marketDay, marketHour } from './time.js';

const MINUTE = 60 * 1000;
export const REFRESH_MS = 60 * MINUTE;
export const TOMORROW_RETRY_MS = 15 * MINUTE;
export const TOMORROW_FROM_HOUR = 13;
const FAILURE_BACKOFF_MS = [5, 10, 20, 40, 60].map((minutes) => minutes * MINUTE);

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {() => number} [options.now]
 */
export function createMarket({ fetch = globalThis.fetch, now = () => Date.now() } = {}) {
  // The market slots `{ start, end, market }` of `country`.
  let data = { country: null, slots: [] };
  let lastSuccessAt = null;
  let lastAttemptAt = null;
  let failures = 0;

  /** Whether a refresh is due at `at`, and why (for the debug log). */
  function dueReason(country, at) {
    if (data.country !== null && data.country !== country) {
      return 'country changed';
    }
    if (lastAttemptAt !== null && failures > 0) {
      const wait = FAILURE_BACKOFF_MS[Math.min(failures, FAILURE_BACKOFF_MS.length) - 1];
      return at - lastAttemptAt >= wait ? 'retry after a failure' : null;
    }
    if (lastSuccessAt === null) {
      return 'first refresh';
    }
    if (at - lastSuccessAt >= REFRESH_MS) {
      return 'hourly refresh';
    }
    const today = marketDay(new Date(at));
    // Tomorrow's prices published after midnight (a late auction, an API
    // down in the evening): the new day must not wait an hour for them.
    if (slotsOfDay(data.slots, today).length === 0 && at - lastAttemptAt >= TOMORROW_RETRY_MS) {
      return "waiting for today's prices";
    }
    if (
      slotsOfDay(data.slots, addDays(today)).length === 0 &&
      marketHour(new Date(at)) >= TOMORROW_FROM_HOUR &&
      at - lastAttemptAt >= TOMORROW_RETRY_MS
    ) {
      return "waiting for tomorrow's prices";
    }
    return null;
  }

  return {
    get lastSuccessAt() {
      return lastSuccessAt;
    },
    get failing() {
      return failures > 0;
    },

    /**
     * @param {string} country
     * @returns {string | null} why a refresh is due now, or null
     */
    dueReason(country) {
      return dueReason(country, now());
    },

    /**
     * Read the prices of today and tomorrow.
     * @param {string} country
     * @throws {import('./awattar.js').AwattarError} data kept as it was
     */
    async refresh(country) {
      const at = now();
      lastAttemptAt = at;
      const today = marketDay(new Date(at));
      try {
        const slots = await fetchMarketData({
          country,
          // From 23:00 the day before: the price of the hour before
          // midnight tells whether 00:00 crosses a threshold.
          start: dayStart(today).getTime() - 60 * MINUTE,
          end: dayStart(addDays(today, 2)).getTime(),
          fetch,
        });
        const changed = country !== data.country || fingerprint(slots) !== fingerprint(data.slots);
        data = { country, slots };
        lastSuccessAt = at;
        failures = 0;
        return { changed };
      } catch (err) {
        failures += 1;
        if (data.country !== country) {
          // The prices of another country must not stand for this one.
          data = { country, slots: [] };
        }
        throw err;
      }
    },

    /**
     * Everything the device, the widget and the triggers show, at `at`,
     * priced with the tariff of the configuration.
     * @param {ReturnType<import('./config.js').normalizeConfig>} config
     * @param {Date} [at]
     */
    snapshot(config, at = new Date(now())) {
      const known = data.country === config.country ? data.slots : [];
      const slots = known.map((slot) => ({ ...slot, price: tariffPrice(slot.market, config) }));
      const today = marketDay(at);
      const todaySlots = slotsOfDay(slots, today);
      const current = slotAt(slots, at);
      return {
        at,
        today,
        current,
        next: current ? slotAfter(slots, current) : null,
        rank: current && todaySlots.includes(current) ? rankOf(todaySlots, current) : null,
        todaySlots,
        todaySummary: summarize(todaySlots),
        tomorrowSlots: slotsOfDay(slots, addDays(today)),
        // Every known hour, the one before midnight included.
        slots,
      };
    },
  };
}

function fingerprint(slots) {
  return JSON.stringify(slots.map((slot) => [slot.start.getTime(), slot.market]));
}
