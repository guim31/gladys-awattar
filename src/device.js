// -----------------------------------------------------------------------------
// The one device: the aWATTar HOURLY prices of the configured country.
//
// Its external id is built on the country ("de" or "at"), the only identity
// the prices have: changing the tariff fields or the VAT setting keeps the
// device, its history and the scenes using it; another country is another
// market, so another device. Feature keys are forever, like the ids built on
// them.
//
// Every feature is a read-only sensor. Prices use `currency/decimal` in euros
// (Gladys has no €/kWh unit: the name carries it); the hours are `text/text`
// ("03:00", Central European Time); the rank of the current hour is a
// `counter-sensor/integer`, so a scene can say "rank ≤ 4" with the core's own
// threshold condition.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { NAMES } from './i18n.js';
import { roundPrice } from './prices.js';
import { marketTime } from './time.js';

const DEVICE_TYPE = 'prices';
// Brand names, not translated.
const DEVICE_NAMES = { de: 'aWATTar Deutschland', at: 'aWATTar Österreich' };

export const FEATURE = {
  PRICE_NOW: 'price_now',
  PRICE_NEXT: 'price_next',
  PRICE_AVG_TODAY: 'price_avg_today',
  PRICE_MIN_TODAY: 'price_min_today',
  PRICE_MAX_TODAY: 'price_max_today',
  CHEAPEST_HOUR_TODAY: 'cheapest_hour_today',
  PRICIEST_HOUR_TODAY: 'priciest_hour_today',
  PRICE_RANK_NOW: 'price_rank_now',
  MARKET_PRICE_NOW: 'market_price_now',
};

// Display bounds only (the core never applies them): the EPEX day-ahead
// price is capped at -0.5 and 4 €/kWh (harmonised limits), and goes negative
// on a sunny Sunday.
const ELECTRICITY_BOUNDS = { min: -1, max: 4 };
// 25 hours on the day the clocks go back.
const RANK_BOUNDS = { min: 1, max: 25 };
// text/text: min and max are NOT NULL in the core (422 on "Add to Gladys").
const TEXT_BOUNDS = { min: 0, max: 0 };

/** @param {object} gladys */
export function deviceIds(gladys, country) {
  return gladys.externalIds(DEVICE_TYPE, country);
}

/**
 * @param {object} gladys
 * @param {ReturnType<import('./config.js').normalizeConfig>} config
 */
export function buildDevice(gladys, config) {
  const ids = deviceIds(gladys, config.country);
  const names = NAMES[config.language] ?? NAMES.en;
  const price = (key) => ({
    name: names[key],
    external_id: ids.feature(key),
    category: DEVICE_FEATURE_CATEGORIES.CURRENCY,
    type: DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
    unit: DEVICE_FEATURE_UNITS.EURO,
    ...ELECTRICITY_BOUNDS,
    read_only: true,
    has_feedback: false,
    keep_history: true,
  });
  const text = (key) => ({
    name: names[key],
    external_id: ids.feature(key),
    category: DEVICE_FEATURE_CATEGORIES.TEXT,
    type: DEVICE_FEATURE_TYPES.TEXT.TEXT,
    ...TEXT_BOUNDS,
    read_only: true,
    has_feedback: false,
    keep_history: false,
  });

  const features = [
    price(FEATURE.PRICE_NOW),
    price(FEATURE.PRICE_NEXT),
    price(FEATURE.PRICE_AVG_TODAY),
    price(FEATURE.PRICE_MIN_TODAY),
    price(FEATURE.PRICE_MAX_TODAY),
    text(FEATURE.CHEAPEST_HOUR_TODAY),
    text(FEATURE.PRICIEST_HOUR_TODAY),
    {
      name: names[FEATURE.PRICE_RANK_NOW],
      external_id: ids.feature(FEATURE.PRICE_RANK_NOW),
      category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
      type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
      ...RANK_BOUNDS,
      read_only: true,
      has_feedback: false,
      keep_history: true,
    },
    price(FEATURE.MARKET_PRICE_NOW),
  ];

  return {
    name: DEVICE_NAMES[config.country],
    external_id: ids.device,
    model: `aWATTar HOURLY ${config.country.toUpperCase()}`,
    // Polled once a minute by the core when it does (Gladys#3198: often not):
    // the container's own timer does the work, onPoll is the fallback.
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features,
  };
}

/**
 * The states of the device for a market snapshot. A value the snapshot does
 * not know (no price for the current hour) is left out: the
 * feature keeps its last state rather than receiving a made-up one.
 * @param {object} gladys
 * @param {ReturnType<ReturnType<import('./market.js').createMarket>['snapshot']>} snapshot
 */
export function buildStates(gladys, snapshot, country) {
  const ids = deviceIds(gladys, country);
  const states = [];
  const number = (key, value) =>
    states.push({ device_feature_external_id: ids.feature(key), state: value });
  const text = (key, value) =>
    states.push({ device_feature_external_id: ids.feature(key), text: value });

  if (snapshot.current) {
    number(FEATURE.PRICE_NOW, roundPrice(snapshot.current.price));
    number(FEATURE.MARKET_PRICE_NOW, roundPrice(snapshot.current.market));
  }
  if (snapshot.next) {
    number(FEATURE.PRICE_NEXT, roundPrice(snapshot.next.price));
  }
  const summary = snapshot.todaySummary;
  if (summary) {
    number(FEATURE.PRICE_AVG_TODAY, roundPrice(summary.average));
    number(FEATURE.PRICE_MIN_TODAY, roundPrice(summary.min.price));
    number(FEATURE.PRICE_MAX_TODAY, roundPrice(summary.max.price));
    text(FEATURE.CHEAPEST_HOUR_TODAY, marketTime(summary.min.start));
    text(FEATURE.PRICIEST_HOUR_TODAY, marketTime(summary.max.start));
  }
  if (snapshot.rank !== null) {
    number(FEATURE.PRICE_RANK_NOW, snapshot.rank);
  }
  return states;
}
