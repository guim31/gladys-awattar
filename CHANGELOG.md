# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- The aWATTar HOURLY prices of Germany or Austria, from the public aWATTar API (no
  account, no key): one read-only device with the current price, the next hour
  price, the average, lowest and highest price of the day with their hours, the
  rank of the current hour and the raw EPEX Spot market price.
- The tariff, not only the spot price: market price plus aWATTar's surcharge
  (Austria 1.5 ct/kWh), an optional markup, and the VAT of the country, every
  part editable.
- The "Electricity prices" dashboard widget: now, next hour, today's average, the
  chart of today and tomorrow, the cheapest hours.
- Scene triggers: "Cheapest hours of the day begin", "One of the cheapest hours
  begins" and "The price drops below a threshold".
- A "Refresh the prices now" action, and texts in English, French, German and
  Spanish. Requires Gladys 5.3.0 or later.
