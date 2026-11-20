// -----------------------------------------------------------------------------
// Every text the integration shows to the user, in the four languages of the
// Gladys interface (en, fr, de, es). German says "du", Spanish says "usted",
// like the rest of guim31's integrations. The vocabulary follows the Gladys
// interface (Strompreis, Precio de la electricidad...).
//
// ActionFailure carries a four-language message: Gladys shows a thrown error
// in red, a returned value in green.
//
//   - NAMES    : the feature names, frozen when the user adds the device, in
//                the language of the configuration;
//   - TEXT     : the fixed texts (widget, connection status);
//   - MESSAGES : the texts built from a value.
//
// test/i18n.test.js checks that every entry carries exactly the four
// languages.
// -----------------------------------------------------------------------------

/** Feature names, by language then feature key (≤ 40 characters). */
export const NAMES = {
  en: {
    price_now: 'Current price (€/kWh)',
    price_next: 'Next hour price (€/kWh)',
    price_avg_today: 'Average price today (€/kWh)',
    price_min_today: 'Lowest price today (€/kWh)',
    price_max_today: 'Highest price today (€/kWh)',
    cheapest_hour_today: 'Cheapest hour today',
    priciest_hour_today: 'Most expensive hour today',
    price_rank_now: 'Hour rank (1 = cheapest)',
    market_price_now: 'Market price now (€/kWh, net)',
  },
  fr: {
    price_now: 'Prix actuel (€/kWh)',
    price_next: 'Prix heure suivante (€/kWh)',
    price_avg_today: 'Prix moyen du jour (€/kWh)',
    price_min_today: 'Prix min du jour (€/kWh)',
    price_max_today: 'Prix max du jour (€/kWh)',
    cheapest_hour_today: 'Heure la moins chère du jour',
    priciest_hour_today: 'Heure la plus chère du jour',
    price_rank_now: "Rang de l'heure (1 = moins chère)",
    market_price_now: 'Prix du marché actuel (€/kWh HT)',
  },
  de: {
    price_now: 'Aktueller Strompreis (€/kWh)',
    price_next: 'Preis nächste Stunde (€/kWh)',
    price_avg_today: 'Durchschnittspreis heute (€/kWh)',
    price_min_today: 'Tiefstpreis heute (€/kWh)',
    price_max_today: 'Höchstpreis heute (€/kWh)',
    cheapest_hour_today: 'Günstigste Stunde heute',
    priciest_hour_today: 'Teuerste Stunde heute',
    price_rank_now: 'Rang der Stunde (1 = günstigste)',
    market_price_now: 'Börsenpreis aktuell (€/kWh netto)',
  },
  es: {
    price_now: 'Precio actual (€/kWh)',
    price_next: 'Precio próxima hora (€/kWh)',
    price_avg_today: 'Precio medio de hoy (€/kWh)',
    price_min_today: 'Precio mínimo de hoy (€/kWh)',
    price_max_today: 'Precio máximo de hoy (€/kWh)',
    cheapest_hour_today: 'Hora más barata de hoy',
    priciest_hour_today: 'Hora más cara de hoy',
    price_rank_now: 'Rango de la hora (1 = más barata)',
    market_price_now: 'Precio de mercado actual (€/kWh neto)',
  },
};

/** Fixed texts. */
export const TEXT = {
  // Widget (labels ≤ 24, captions ≤ 80)
  now: { en: 'Now', fr: 'Maintenant', de: 'Jetzt', es: 'Ahora' },
  nextHour: { en: 'Next hour', fr: 'Heure suivante', de: 'Nächste Stunde', es: 'Próxima hora' },
  average: {
    en: 'Today average',
    fr: 'Moyenne du jour',
    de: 'Schnitt heute',
    es: 'Media de hoy',
  },
  today: { en: 'Today', fr: "Aujourd'hui", de: 'Heute', es: 'Hoy' },
  tomorrow: { en: 'Tomorrow', fr: 'Demain', de: 'Morgen', es: 'Mañana' },
  min: { en: 'Min', fr: 'Min', de: 'Min', es: 'Mín' },
  max: { en: 'Max', fr: 'Max', de: 'Max', es: 'Máx' },
  cheapestToday: {
    en: 'Cheapest today',
    fr: "Moins cher aujourd'hui",
    de: 'Am günstigsten heute',
    es: 'Más barato hoy',
  },
  cheapestTomorrow: {
    en: 'Cheapest tomorrow',
    fr: 'Moins cher demain',
    de: 'Am günstigsten morgen',
    es: 'Más barato mañana',
  },
  tomorrowAverage: {
    en: 'Tomorrow average',
    fr: 'Moyenne de demain',
    de: 'Schnitt morgen',
    es: 'Media de mañana',
  },
  tomorrowPending: {
    en: 'Not published yet',
    fr: 'Pas encore publié',
    de: 'Noch nicht bekannt',
    es: 'Aún no publicado',
  },
  marketNow: {
    en: 'Market price now',
    fr: 'Prix du marché actuel',
    de: 'Börsenpreis jetzt',
    es: 'Precio de mercado ahora',
  },
  tariffVat: {
    en: 'aWATTar HOURLY price, VAT included',
    fr: 'Prix aWATTar HOURLY, TVA incluse',
    de: 'aWATTar-HOURLY-Preis inklusive MwSt.',
    es: 'Precio aWATTar HOURLY, IVA incluido',
  },
  tariffNoVat: {
    en: 'aWATTar HOURLY price, VAT excluded',
    fr: 'Prix aWATTar HOURLY, hors TVA',
    de: 'aWATTar-HOURLY-Preis ohne MwSt.',
    es: 'Precio aWATTar HOURLY, sin IVA',
  },
  noPrices: {
    en: 'No price received from aWATTar yet: check the integration logs.',
    fr: "Aucun prix reçu d'aWATTar pour l'instant : consultez les logs de l'intégration.",
    de: 'Noch kein Preis von aWATTar erhalten: Sieh dir die Protokolle der Integration an.',
    es: 'Todavía no se ha recibido ningún precio de aWATTar: consulte los registros de la integración.',
  },

  // Configuration screen
  initFailed: {
    en: 'Initialization failed, check the integration logs.',
    fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
    de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    es: 'La inicialización ha fallado, consulte los registros de la integración.',
  },
  unreachable: {
    en: 'aWATTar cannot be reached: the last known prices stay in use.',
    fr: 'aWATTar est injoignable : les derniers prix connus restent utilisés.',
    de: 'aWATTar ist nicht erreichbar: Die zuletzt bekannten Preise bleiben in Gebrauch.',
    es: 'No se puede acceder a aWATTar: se siguen usando los últimos precios conocidos.',
  },
  noPriceToday: {
    en: 'aWATTar answers, but publishes no price for today yet.',
    fr: "aWATTar répond, mais ne publie encore aucun prix pour aujourd'hui.",
    de: 'aWATTar antwortet, veröffentlicht aber noch keinen Preis für heute.',
    es: 'aWATTar responde, pero aún no publica ningún precio para hoy.',
  },
};

/** Texts built from a value. */
export const MESSAGES = {
  /**
   * Result of the "Refresh now" action.
   * @param {{ today: number, tomorrow: number, price: string | null, market: string | null }} r
   */
  refreshed: ({ today, tomorrow, price, market }) => ({
    en: [
      `Prices received: ${today} hours today, ${tomorrow > 0 ? `${tomorrow} hours tomorrow` : 'tomorrow not published yet'}.`,
      price
        ? `Current price: ${price} €/kWh (market: ${market} €/kWh net).`
        : 'No price for the current hour.',
    ].join('\n'),
    fr: [
      `Prix reçus : ${today} heures aujourd'hui, ${tomorrow > 0 ? `${tomorrow} heures demain` : 'demain pas encore publié'}.`,
      price
        ? `Prix actuel : ${price} €/kWh (marché : ${market} €/kWh HT).`
        : "Aucun prix pour l'heure en cours.",
    ].join('\n'),
    de: [
      `Preise erhalten: ${today} Stunden heute, ${tomorrow > 0 ? `${tomorrow} Stunden morgen` : 'morgen noch nicht veröffentlicht'}.`,
      price
        ? `Aktueller Preis: ${price} €/kWh (Börse: ${market} €/kWh netto).`
        : 'Kein Preis für die aktuelle Stunde.',
    ].join('\n'),
    es: [
      `Precios recibidos: ${today} horas hoy, ${tomorrow > 0 ? `${tomorrow} horas mañana` : 'mañana todavía no publicado'}.`,
      price
        ? `Precio actual: ${price} €/kWh (mercado: ${market} €/kWh neto).`
        : 'No hay precio para la hora actual.',
    ].join('\n'),
  }),

  /**
   * The refresh action failed.
   * @param {string} reason technical reason (no secret: a public API)
   */
  refreshFailed: (reason) => ({
    en: `aWATTar cannot be reached (${reason}). The last known prices stay in use.`,
    fr: `aWATTar est injoignable (${reason}). Les derniers prix connus restent utilisés.`,
    de: `aWATTar ist nicht erreichbar (${reason}). Die zuletzt bekannten Preise bleiben in Gebrauch.`,
    es: `No se puede acceder a aWATTar (${reason}). Se siguen usando los últimos precios conocidos.`,
  }),
};

/**
 * The text of a multi-language object in `language`, English otherwise.
 * @param {Record<string, string>} text
 * @param {string} language
 */
export function pick(text, language) {
  return text[language] ?? text.en;
}

/** An action failure: Gladys shows its four-language message in red. */
export class ActionFailure extends Error {
  /** @param {Record<string, string>} text */
  constructor(text) {
    super(text.en);
    this.message = text;
  }
}
