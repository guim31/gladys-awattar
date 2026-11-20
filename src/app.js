// -----------------------------------------------------------------------------
// The integration: registers every SDK handler on a GladysIntegration (or the
// SDK's fake Gladys in the tests) and runs the refresh cycle, so index.js stays
// a few lines and the tests drive the very same wiring.
//
// One cycle, every minute on the container's own timer (the core's onPoll is
// only a fallback, Gladys#3198):
//   1. ask aWATTar again when the refresh policy says so (src/market.js);
//   2. publish the states of the device, if the user added it — only the
//      values that changed, plus a heartbeat (the SDK deduplicates);
//   3. when an hour begins, fire the scene triggers it matches.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './config.js';
import { buildDevice, buildStates, deviceIds } from './device.js';
import { ActionFailure, MESSAGES, TEXT } from './i18n.js';
import { createIssueLog } from './issues.js';
import { createMarket } from './market.js';
import { createSceneLedger } from './ledger.js';
import { eventsForSlot } from './triggers.js';
import { buildPricesContent, formatPrice, WIDGET } from './widget.js';

const logger = createLogger({ name: 'awattar' });

const MINUTE = 60 * 1000;
// A value that does not change (the average price of the day) is sent again
// every 6 hours: without a recent value, Gladys shows "no recent value".
export const HEARTBEAT_MS = 6 * 60 * MINUTE;
// The core's onPoll runs a cycle only when the timer missed one.
const POLL_FALLBACK_MS = 90 * 1000;
// An hour that began longer ago than this when its prices became known (the
// container started late, aWATTar was down) fires no trigger: a scene
// waiting for "the cheapest hour begins" must not run at 03:45.
export const LATE_EVENT_MS = 10 * MINUTE;

/**
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams
 * @param {typeof fetch} [options.fetch]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the minute timer
 * @param {string} [options.dataDir] where the scene ledger is kept
 */
export function createApp(gladys, options = {}) {
  const now = options.now ?? (() => Date.now());
  const market = createMarket({ fetch: options.fetch, now });
  const ledger = createSceneLedger(options.dataDir ?? '/data');
  const issues = createIssueLog(logger);
  const timers = options.timers ?? true;

  let config = normalizeConfig();
  let timer = null;
  let stopped = false;
  let running = null;
  let lastCycleAt = null;
  let lastStatus = null;
  let announced = false;

  const deviceCreated = () =>
    (gladys.devices ?? []).some(
      (device) => device.external_id === deviceIds(gladys, config.country).device,
    );

  async function setStatus(connected, message) {
    const key = JSON.stringify([connected, message ?? null]);
    if (key === lastStatus) {
      return;
    }
    try {
      await gladys.setConnectionStatus(connected, message);
      lastStatus = key;
    } catch (err) {
      // Sent again on the next cycle.
      logger.debug(`Connection status not sent (${err.message})`);
    }
  }

  /** Nudge the open dashboards; dropped silently while disconnected. */
  function refreshWidget() {
    try {
      gladys.requestWidgetRefresh(WIDGET.PRICES);
    } catch (err) {
      logger.debug(`Widget refresh not sent (${err.message})`);
    }
  }

  /**
   * @param {string} reason
   * @param {{ rethrow?: boolean }} [options]
   */
  async function refresh(reason, { rethrow = false } = {}) {
    logger.debug(`Reading the prices (${reason})`);
    try {
      const { changed } = await market.refresh(config.country);
      const snapshot = market.snapshot(config);
      const summary =
        `${snapshot.todaySlots.length} hours today, ` +
        `${snapshot.tomorrowSlots.length} hours tomorrow`;
      if (!announced) {
        logger.info(`aWATTar ${config.country.toUpperCase()} reachable: ${summary}`);
        announced = true;
      } else {
        logger.debug(`Prices read: ${summary}${changed ? ', new prices' : ''}`);
      }
      issues.ok('api', `aWATTar answers again: ${summary}`);
      if (snapshot.todaySlots.length === 0) {
        issues.fail('today', 'aWATTar publishes no price for today');
        await setStatus(false, TEXT.noPriceToday);
      } else {
        issues.ok('today', 'aWATTar publishes the prices of today again');
        await setStatus(true);
      }
      if (changed) {
        refreshWidget();
      }
    } catch (err) {
      issues.fail('api', `aWATTar refresh failed (${err.message}), last known prices kept`);
      await setStatus(false, TEXT.unreachable);
      if (rethrow) {
        throw err;
      }
    }
  }

  async function publishStates(snapshot) {
    if (!deviceCreated()) {
      return;
    }
    try {
      const { count } = await gladys.publishChangedStates(
        buildStates(gladys, snapshot, config.country),
        {
          heartbeat: HEARTBEAT_MS,
        },
      );
      if (count > 0) {
        logger.debug(`${count} state(s) published`);
      }
      issues.ok('states', 'States accepted by Gladys again');
    } catch (err) {
      issues.fail('states', `Publishing the states failed (${err.message})`);
    }
  }

  async function fireSceneEvents(snapshot) {
    const slot = snapshot.current;
    if (!slot || !snapshot.todaySlots.includes(slot) || ledger.done(slot.start)) {
      return;
    }
    if (now() - slot.start.getTime() > LATE_EVENT_MS) {
      logger.debug(`Hour ${slot.start.toISOString()} began too long ago: no scene event`);
      await ledger.markDone(slot.start);
      return;
    }
    for (const event of eventsForSlot(snapshot.todaySlots, slot, snapshot.slots)) {
      const id = `${event.key}:${event.data.hours ?? event.data.threshold}`;
      if (ledger.sent(slot.start, id)) {
        continue;
      }
      try {
        await gladys.publishSceneEvent(event.key, event.data);
        ledger.markSent(slot.start, id);
        logger.debug(`Scene event ${id} (${event.data.start_time})`);
        issues.ok('scene', 'Scene events accepted by Gladys again');
      } catch (err) {
        // Tried again on the next cycle, within LATE_EVENT_MS.
        issues.fail('scene', `Firing the scene event ${event.key} failed (${err.message})`);
        return;
      }
    }
    await ledger.markDone(slot.start);
  }

  async function runCycle({ forceRefresh = false } = {}) {
    lastCycleAt = now();
    const reason = forceRefresh ? 'asked by the user' : market.dueReason(config.country);
    if (reason) {
      await refresh(reason, { rethrow: forceRefresh });
    }
    if (gladys.connected === false) {
      logger.debug('Gladys unreachable: nothing published');
      return;
    }
    const snapshot = market.snapshot(config);
    await publishStates(snapshot);
    await fireSceneEvents(snapshot);
  }

  /**
   * One cycle; a second caller waits for the one in progress. A forced
   * refresh (the user's action) waits for it, then runs its own.
   */
  async function cycle(cycleOptions = {}) {
    while (running && cycleOptions.forceRefresh) {
      await running.catch(() => {});
    }
    if (running) {
      return running;
    }
    running = runCycle(cycleOptions);
    try {
      return await running;
    } finally {
      running = null;
    }
  }

  // The timer ticks 2 s after every minute, so an hour that begins is seen
  // within seconds.
  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    const delay = MINUTE - (now() % MINUTE) + 2000;
    timer = setTimeout(async () => {
      timer = null;
      try {
        await cycle();
      } catch (err) {
        logger.error(`Refresh cycle failed (${err.message})`);
      } finally {
        schedule();
      }
    }, delay);
  }

  async function publishDevice() {
    await gladys.publishDiscoveredDevices([buildDevice(gladys, config)]);
  }

  // --- Handlers ---------------------------------------------------------------

  gladys.onScanRequest(async () => {
    logger.debug('onScanRequest -> publishing the device');
    await publishDevice();
  });

  // The fallback: the core polls the device (when it does, Gladys#3198).
  gladys.onPoll(async () => {
    if (lastCycleAt !== null && now() - lastCycleAt < POLL_FALLBACK_MS) {
      logger.debug('onPoll skipped: the timer is running');
      return;
    }
    await cycle();
  });

  // The device was just added: the SDK forgot what it had published (Gladys
  // drops the states of a feature that did not exist yet), send it all now.
  const onDeviceChange = async () => {
    await publishStates(market.snapshot(config));
    refreshWidget();
  };
  gladys.onDeviceCreated(onDeviceChange);
  gladys.onDeviceUpdated(onDeviceChange);

  // Gladys shows what the handler returns in green and what it throws in
  // red: every failure throws.
  gladys.onAction('refresh', async () => {
    logger.info('Action refresh <- reading the prices now');
    try {
      // Read less than a minute ago: the same answer, no new request.
      await cycle({ forceRefresh: !market.freshFor(config.country, MINUTE) });
    } catch (err) {
      throw new ActionFailure(MESSAGES.refreshFailed(err.message));
    }
    const snapshot = market.snapshot(config);
    if (snapshot.todaySlots.length === 0) {
      throw new ActionFailure(TEXT.noPriceToday);
    }
    return MESSAGES.refreshed({
      today: snapshot.todaySlots.length,
      tomorrow: snapshot.tomorrowSlots.length,
      price: snapshot.current ? formatPrice(snapshot.current.price, config.language) : null,
      market: snapshot.current ? formatPrice(snapshot.current.market, config.language) : null,
    });
  });

  gladys.onWidgetGet(WIDGET.PRICES, async ({ language }) =>
    buildPricesContent({ snapshot: market.snapshot(config), config, language }),
  );

  gladys.onConfigUpdated(async (newConfig) => {
    logger.info('Configuration updated');
    config = normalizeConfig(newConfig);
    // Another tariff: every value changes, send them all again.
    gladys.forgetPublishedStates();
    // Another country is another device (and another language other names).
    await publishDevice();
    // A new country is read at once (market.dueReason says so).
    await cycle();
    refreshWidget();
  });

  gladys.on('connected', async () => {
    try {
      // Whatever was shown before the connection dropped, say it again.
      lastStatus = null;
      config = normalizeConfig(await gladys.getConfig());
      await publishDevice();
      await ledger.load();
      stopped = false;
      schedule();
      await cycle();
      // The nudges sent while the socket was down were dropped.
      refreshWidget();
    } catch (err) {
      logger.error(`Post-connection initialization failed (${err.message})`);
      await gladys.setConnectionStatus(false, TEXT.initFailed).catch(() => {});
    }
  });

  return {
    market,
    cycle,
    get config() {
      return config;
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
    },
  };
}
