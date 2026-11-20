# aWATTar for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) integration for the **aWATTar
HOURLY** dynamic electricity tariff, in **Germany** (now tado° Energy) and
**Austria**: the price of the current hour, the cheapest hours of the day, a chart
of today and tomorrow, and scene triggers to run appliances when electricity is
cheapest. Public market data: no account, no API key.

Tested against the live aWATTar API, but developed without an aWATTar contract:
feedback welcome.

## Features

- **One device per country, read-only**: current aWATTar HOURLY price, next hour
  price, average, lowest and highest price of the day with the hour of the lowest
  and of the highest, rank of the current hour (1 = cheapest), and the raw EPEX Spot
  market price of the current hour. €/kWh.
- **The tariff, not only the spot price**: market price + aWATTar's components
  (Austria: + 1.5 ct/kWh, 20 % VAT; Germany: 19 % VAT, the regional costs of your
  contract to enter), every part editable: surcharge, markup, VAT rate.
- **Dashboard widget** "Electricity prices": tiles for now, next hour and today's
  average, a step chart of today and tomorrow with the minimum and maximum marked,
  the cheapest hours and the market price.
- **Scene triggers**: "Cheapest hours of the day begin" (the cheapest run of 1 to 8
  consecutive hours), "One of the cheapest hours begins" (each of the N cheapest
  hours) and "The price drops below a threshold" (0 to 40 ct/kWh, with the end of
  the cheap run).
- Feature names and widget in English, French, German and Spanish.

### Compared with the other price integrations

- [EPEX Spot](https://github.com/gboulvin/Gladys-EPEX-Spot) and
  [ENTSO-E](https://github.com/LM1LC3N7/gladys-entsoe) give the **raw day-ahead
  market price** of many zones, DE-LU and AT included. This integration gives the
  **aWATTar HOURLY price** a customer pays per kWh (energy part), hour by hour.
- [Ostrom](https://github.com/LM1LC3N7/gladys-ostrom) reads the account of an Ostrom
  customer; this one needs no account.
- It mirrors [Frank Energie](https://github.com/guim31/gladys-frank-energie) and
  [EnergyZero](https://github.com/guim31/gladys-energyzero) (same device, widget and
  triggers), so scenes move from one to the other.

## Requirements

- Gladys Assistant **5.3.0** or later.
- Internet access from Gladys to `api.awattar.de` or `api.awattar.at`.

## Installation

In Gladys: **Integrations → Install from GitHub**, enter
`https://github.com/guim31/gladys-awattar`. Pick the country in the configuration,
then add the aWATTar device from the **Discovery** tab, and the "Electricity prices"
widget on a dashboard.

The user documentation, in four languages, is in [`docs/`](docs/en.md).

## How it works

The container reads `GET https://api.awattar.{de,at}/v1/marketdata?start=…&end=…`
(public, EUR/MWh, VAT excluded) from 23:00 the day before to the day after tomorrow:
one request an hour, every 15 minutes from 13:00 until tomorrow's prices are out
(around 14:00), with back-off after a failure; the last known prices stay in use
meanwhile. aWATTar asks for 100 requests a day at most: the integration makes about
24, 60 at worst. A timer in the container refreshes the states every minute (the
core's `onPoll` is only a fallback, Gladys#3198), publishes only what changed (plus
a 6-hour heartbeat) and fires the scene triggers when an hour begins. A day is a
calendar day of Central European Time, whatever the timezone of Gladys.

Price of an hour: `(market + |market| × markup % + surcharge) × (1 + VAT %)`, the
formula aWATTar publishes for Austria (checked against its worked examples).

## Limitations

- The German tariff has no single published surcharge (regional costs): the default
  is the market price plus VAT, the user adds the per-kWh costs of their contract.
- Grid fees, levies and the fixed monthly fee are not included by default.
- Hourly prices, as the HOURLY tariff bills them (quarter hours, should the API send
  them, are averaged to the hour).
- No login: no consumption, no costs.
- The triggers consider the current day only: a cheapest run never spans midnight.
- Read-only: the integration controls nothing.

## Development

Node.js 22+, ESM, no build step. The only runtime dependency is
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test              # node --test, against the SDK's fake Gladys and a fake API
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store .   # store validator
```

```
index.js              SDK wiring (src/app.js registers the handlers)
src/app.js            refresh cycle, states, scene events, action, widget, lifecycle
src/awattar.js        client of the public market data API
src/config.js         configuration, tariff of each country, price formula
src/market.js         known prices and refresh policy
src/prices.js         pure computations (current, rank, cheapest window...)
src/device.js         the device and its states
src/triggers.js       scene events of an hour that begins
src/widget.js         the "Electricity prices" widget
src/ledger.js         hours whose scene events are out, kept in /data
src/time.js           the Central European market clock
src/i18n.js           every user-facing text, four languages
test/fixtures/        real API answers (DE and AT, 24 to 26 October and 20 November 2026)
```

To run it outside Gladys:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="awattar" \
AWATTAR_DATA_DIR=./data \
npm start
```

Releases are made by the **Release** workflow (Actions → Release); never edit
the versions by hand. A hand-pushed `vX.Y.Z` tag also builds the image and the
GitHub Release, but then `version` in `package.json` and in the manifest (with
the `docker_image` tag) must be bumped and committed before tagging. See
[`CLAUDE.md`](CLAUDE.md) for the project rules.

## Credits

- [aWATTar](https://www.awattar.at) for its public market data API and the
  published HOURLY tariff.
- The aWATTar source of [ha_epex_spot](https://github.com/mampfes/ha_epex_spot) by
  mampfes (MIT), the Home Assistant integration: the API and its fields. No code is
  copied from it.
- [gladys-frank-energie](https://github.com/guim31/gladys-frank-energie): the device,
  widget, triggers and refresh policy this integration takes up.
- Cover: the official aWATTar logo, from [awattar.at](https://www.awattar.at), on
  the brand color.

## Disclaimer

This project is not affiliated with, endorsed or sponsored by aWATTar GmbH, aWATTar
Deutschland GmbH or tado GmbH. "aWATTar" and "tado°" are trademarks of their owners.
The prices are informational: check your contract.

## License

[Apache-2.0](LICENSE)
