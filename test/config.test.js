import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, parseDecimal, tariffPrice } from '../src/config.js';

test('defaults: Germany, VAT included, the tariff of the country', () => {
  assert.deepEqual(normalizeConfig(), {
    language: 'fr',
    country: 'de',
    include_vat: true,
    surcharge: 0,
    markup: 0,
    vat: 19,
  });
  assert.equal(DEFAULT_CONFIG.surcharge, '', 'empty means "the value of the country"');
  assert.deepEqual(normalizeConfig({ country: 'at' }), {
    ...normalizeConfig(),
    country: 'at',
    surcharge: 1.5,
    vat: 20,
  });
});

test('the values a form may send as strings, with a comma, or wrong', () => {
  const config = normalizeConfig({
    include_vat: 'false',
    language: 'xx',
    country: 'nl',
    surcharge: ' 12,34 ',
    markup_percent: '3',
    vat_percent: 'abc',
  });
  assert.equal(config.include_vat, false);
  assert.equal(config.language, 'fr');
  assert.equal(config.country, 'de');
  assert.equal(config.surcharge, 12.34);
  assert.equal(config.markup, 3);
  assert.equal(config.vat, 19);
  assert.equal(parseDecimal('-2.5', 0, { min: -100, max: 100 }), -2.5);
  assert.equal(parseDecimal('1e3', 7, { min: 0, max: 100 }), 7);
  assert.equal(parseDecimal('500', 7, { min: 0, max: 100 }), 7);
  assert.equal(parseDecimal(4, 7, { min: 0, max: 100 }), 4);
});

test("aWATTar's own Austrian examples: 5.00, 0.00 and -5.00 ct/kWh", () => {
  // awattar.at/tariffs/hourly: (spot + 1.50) + 20 % VAT = 7.80, 1.80, -4.20.
  const at = normalizeConfig({ country: 'at' });
  const ct = (market) => Math.round(tariffPrice(market / 100, at) * 1e6) / 1e4;
  assert.equal(ct(5), 7.8);
  assert.equal(ct(0), 1.8);
  assert.equal(ct(-5), -4.2);
  // Without VAT, and a markup that is a cost on a negative price too.
  const custom = normalizeConfig({ country: 'at', include_vat: false, markup_percent: '10' });
  assert.equal(Math.round(tariffPrice(-0.05, custom) * 1e6) / 1e6, -0.03);
  assert.equal(Math.round(tariffPrice(0.05, custom) * 1e6) / 1e6, 0.07);
});
