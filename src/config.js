// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys, from the `config_schema` of
// `gladys-assistant-integration.json`. This module provides the defaults and
// normalizes the received object, so the rest of the code never deals with
// `undefined`, with booleans sent as strings or with "1,5" typed with a comma.
// -----------------------------------------------------------------------------

/** The languages every text carries, in this order. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

export const COUNTRIES = ['de', 'at'];

// The aWATTar HOURLY energy price of each country, as published by aWATTar
// (checked on 20/11/2026):
//   - Austria (awattar.at/tariffs/hourly): EPEX Spot AT + 1.5 ct/kWh, plus
//     20 % VAT on the whole; worked example 5.00 ct -> (5.00 + 1.50) x 1.2 =
//     7.80 ct/kWh, and a negative market price stays negative.
//   - Germany (now tado° Energy, energy.tado.com/tariffs/hourly): EPEX Spot
//     DE-LU "plus further procurement costs, taxes, levies and grid fees",
//     regional and not published as one figure: 0 ct by default, the user
//     enters the per-kWh costs of their contract; 19 % VAT.
// Grid fees and the fixed monthly fee are never included by default.
export const TARIFF = {
  de: { surcharge: 0, markup: 0, vat: 19 },
  at: { surcharge: 1.5, markup: 0, vat: 20 },
};

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it). An empty
// tariff field means "the value of the country" (TARIFF).
export const DEFAULT_CONFIG = {
  // Language of the feature names and of the texts the container writes
  // (a device integration is not told the user's language).
  language: 'fr',
  country: 'de',
  include_vat: true,
  surcharge: '',
  markup_percent: '',
  vat_percent: '',
};

const asBoolean = (value, fallback) => {
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return fallback;
};

/**
 * A decimal typed by the user ("1,5", " 2.0 "), within bounds; `fallback`
 * when empty or unreadable.
 * @param {unknown} value
 * @param {number} fallback
 * @param {{ min: number, max: number }} bounds
 */
export function parseDecimal(value, fallback, { min, max }) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  }
  const text = String(value ?? '')
    .trim()
    .replace(',', '.');
  if (text === '' || !/^-?\d+(\.\d+)?$/.test(text)) {
    return fallback;
  }
  const number = Number(text);
  return number >= min && number <= max ? number : fallback;
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const country = COUNTRIES.includes(raw.country) ? raw.country : DEFAULT_CONFIG.country;
  const tariff = TARIFF[country];
  return {
    language: LANGUAGES.includes(raw.language) ? raw.language : DEFAULT_CONFIG.language,
    country,
    include_vat: asBoolean(raw.include_vat, DEFAULT_CONFIG.include_vat),
    // ct/kWh, VAT excluded: aWATTar's procurement component, and whatever
    // per-kWh cost the user wants in the final price (grid fees, taxes).
    surcharge: parseDecimal(raw.surcharge, tariff.surcharge, { min: -100, max: 100 }),
    // % of the market price.
    markup: parseDecimal(raw.markup_percent, tariff.markup, { min: 0, max: 100 }),
    vat: parseDecimal(raw.vat_percent, tariff.vat, { min: 0, max: 50 }),
  };
}

/**
 * The aWATTar HOURLY price of an hour, in EUR/kWh:
 *   (market + |market| x markup % + surcharge) x (1 + VAT %)
 * The markup is a cost: it is added on a negative market price too. The
 * VAT applies to the whole, negative prices included (aWATTar's own example).
 * @param {number} market EUR/kWh, VAT excluded
 * @param {ReturnType<typeof normalizeConfig>} config
 */
export function tariffPrice(market, config) {
  const net = market + (Math.abs(market) * config.markup) / 100 + config.surcharge / 100;
  return config.include_vat ? net * (1 + config.vat / 100) : net;
}
