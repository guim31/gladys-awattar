// -----------------------------------------------------------------------------
// aWATTar public market data API (no account, no key).
//
//   GET https://api.awattar.de/v1/marketdata?start=<ms>&end=<ms>   Germany
//   GET https://api.awattar.at/v1/marketdata?start=<ms>&end=<ms>   Austria
//
// The answer is the EPEX Spot day-ahead price of the bidding zone, hour by
// hour, VAT excluded:
//
//   { "object": "list", "data": [
//       { "start_timestamp": 1792792800000, "end_timestamp": 1792796400000,
//         "marketprice": 28.36, "unit": "Eur/MWh" }, ... ] }
//
// Hours not published yet (tomorrow before ~14:00) are simply missing: a
// range in the future answers an empty list. A malformed request answers
// HTTP 500 `{ error: { message } }`. aWATTar asks for fair use: 100 requests
// a day per client at most; this integration stays far below (src/market.js).
// -----------------------------------------------------------------------------

export const API_URLS = {
  de: 'https://api.awattar.de/v1/marketdata',
  at: 'https://api.awattar.at/v1/marketdata',
};

const USER_AGENT = 'gladys-awattar (+https://github.com/guim31/gladys-awattar)';
const HOUR = 60 * 60 * 1000;

/** A failed request, with what the user can be told about it. */
export class AwattarError extends Error {
  /**
   * @param {string} message
   * @param {{ kind: 'network' | 'http' | 'format', status?: number }} details
   */
  constructor(message, { kind, status }) {
    super(message);
    this.name = 'AwattarError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * Read the market prices between two instants.
 * @param {object} options
 * @param {'de' | 'at'} options.country
 * @param {number} options.start ms
 * @param {number} options.end ms
 * @param {typeof fetch} [options.fetch]
 * @param {number} [options.timeoutMs]
 * @returns {Promise<Array<{ start: Date, end: Date, market: number }>>} hourly
 *   slots sorted by start, `market` in EUR/kWh VAT excluded
 */
export async function fetchMarketData({
  country,
  start,
  end,
  fetch = globalThis.fetch,
  timeoutMs = 15000,
}) {
  const url = `${API_URLS[country]}?start=${start}&end=${end}`;
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason = err?.name === 'TimeoutError' ? 'timeout' : (err?.cause?.code ?? err?.message);
    throw new AwattarError(`aWATTar unreachable (${reason})`, { kind: 'network' });
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Handled below.
  }
  if (!response.ok) {
    // A message of the API itself ("value must be a valid date"): no secret.
    const detail = body?.error?.message ? `: ${String(body.error.message).slice(0, 120)}` : '';
    throw new AwattarError(`aWATTar answered HTTP ${response.status}${detail}`, {
      kind: 'http',
      status: response.status,
    });
  }
  if (body === null) {
    throw new AwattarError('aWATTar sent an unreadable answer', { kind: 'format' });
  }
  return parseMarketData(body);
}

/**
 * Turn an answer into hourly slots. Unreadable entries are skipped one by one:
 * a single malformed hour must not hide the other 23. Should aWATTar move to
 * quarter-hours (the EPEX day-ahead market trades them since October 2025),
 * they are averaged back to the hour the HOURLY tariff bills.
 * @param {unknown} body
 */
export function parseMarketData(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.data)) {
    throw new AwattarError('aWATTar sent an unexpected answer', { kind: 'format' });
  }
  const hours = new Map();
  for (const entry of body.data) {
    const start = Number(entry?.start_timestamp);
    const end = Number(entry?.end_timestamp);
    const price = toNumber(entry?.marketprice);
    const perKwh = unitDivisor(entry?.unit);
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      end - start > HOUR ||
      price === null ||
      perKwh === null
    ) {
      continue;
    }
    const hour = start - (start % HOUR);
    const bucket = hours.get(hour) ?? { sum: 0, weight: 0 };
    bucket.sum += (price / perKwh) * (end - start);
    bucket.weight += end - start;
    hours.set(hour, bucket);
  }
  return [...hours.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hour, { sum, weight }]) => ({
      start: new Date(hour),
      end: new Date(hour + HOUR),
      market: Math.round((sum / weight) * 1e6) / 1e6,
    }));
}

/** EUR/MWh (the unit the API sends) or EUR/kWh, to EUR/kWh. */
function unitDivisor(unit) {
  const normalized = String(unit ?? 'Eur/MWh').toLowerCase();
  if (normalized === 'eur/mwh') {
    return 1000;
  }
  if (normalized === 'eur/kwh') {
    return 1;
  }
  return null;
}

/** @param {unknown} value */
function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
