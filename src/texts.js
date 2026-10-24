// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of Gladys. German
// says "du", Spanish "usted". The advice texts follow the RIVM wording:
//
//   geel    "Let op: stoken zorgt voor overlast en luchtverontreiniging."
//   oranje  "Het is beter nu geen hout te stoken."
//   rood    "Stook geen hout."
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

export const CODE_NAMES = {
  en: { yellow: 'Yellow', orange: 'Orange', red: 'Red' },
  fr: { yellow: 'Jaune', orange: 'Orange', red: 'Rouge' },
  de: { yellow: 'Gelb', orange: 'Orange', red: 'Rot' },
  es: { yellow: 'Amarillo', orange: 'Naranja', red: 'Rojo' },
};

export const ADVICE = {
  en: {
    yellow: 'Caution: burning wood causes nuisance and air pollution',
    orange: 'Better not to burn wood now',
    red: 'Do not burn wood',
  },
  fr: {
    yellow: "Attention : faire du feu de bois gêne et pollue l'air",
    orange: 'Mieux vaut ne pas faire de feu de bois maintenant',
    red: 'Ne faites pas de feu de bois',
  },
  de: {
    yellow: 'Achtung: Holz verbrennen belästigt und verschmutzt die Luft',
    orange: 'Besser jetzt kein Holz verbrennen',
    red: 'Verbrenne kein Holz',
  },
  es: {
    yellow: 'Atención: quemar leña molesta y contamina el aire',
    orange: 'Mejor no quemar leña ahora',
    red: 'No queme leña',
  },
};

// Feature names, frozen by Gladys when the device is created.
export const FEATURE_NAMES = {
  en: {
    advice: 'Current advice',
    adviceText: 'Advice',
    next1: 'Next block advice',
    next2: 'Advice in 2 blocks',
    next3: 'Advice in 3 blocks',
    windSpeed: 'Wind speed',
    windForce: 'Wind force (Beaufort)',
    lki: 'Air quality index (LKI)',
  },
  fr: {
    advice: 'Avis actuel',
    adviceText: 'Avis',
    next1: 'Avis du prochain créneau',
    next2: 'Avis dans 2 créneaux',
    next3: 'Avis dans 3 créneaux',
    windSpeed: 'Vitesse du vent',
    windForce: 'Force du vent (Beaufort)',
    lki: "Indice de qualité de l'air (LKI)",
  },
  de: {
    advice: 'Aktueller Rat',
    adviceText: 'Rat',
    next1: 'Rat nächster Zeitblock',
    next2: 'Rat in 2 Zeitblöcken',
    next3: 'Rat in 3 Zeitblöcken',
    windSpeed: 'Windgeschwindigkeit',
    windForce: 'Windstärke (Beaufort)',
    lki: 'Luftqualitätsindex (LKI)',
  },
  es: {
    advice: 'Consejo actual',
    adviceText: 'Consejo',
    next1: 'Consejo próxima franja',
    next2: 'Consejo en 2 franjas',
    next3: 'Consejo en 3 franjas',
    windSpeed: 'Velocidad del viento',
    windForce: 'Fuerza del viento (Beaufort)',
    lki: 'Índice de calidad del aire (LKI)',
  },
};

// Connection status of the Configuration screen.
export const STATUS = {
  en: {
    initFailed: 'Initialization failed, check the integration logs.',
    noHouse: 'Give your house a location in Gladys (Settings, Houses).',
    outside:
      'Your houses are outside the Netherlands: the Stookwijzer only covers the Netherlands.',
    down: 'The RIVM geo service does not answer: the advice will come back with it.',
  },
  fr: {
    initFailed: "L'initialisation a échoué, consultez les logs de l'intégration.",
    noHouse: 'Donnez une position à votre maison dans Gladys (Paramètres, Maisons).',
    outside: 'Vos maisons sont hors des Pays-Bas : le Stookwijzer ne couvre que les Pays-Bas.',
    down: "Le service géographique du RIVM ne répond pas : l'avis reviendra avec lui.",
  },
  de: {
    initFailed: 'Die Initialisierung ist fehlgeschlagen, sieh in die Logs der Integration.',
    noHouse: 'Gib deinem Haus einen Standort in Gladys (Einstellungen, Zuhause).',
    outside:
      'Deine Häuser liegen außerhalb der Niederlande: Der Stookwijzer deckt nur die Niederlande ab.',
    down: 'Der Geodienst des RIVM antwortet nicht: Der Rat kommt mit ihm zurück.',
  },
  es: {
    initFailed: 'La inicialización ha fallado, consulte los registros de la integración.',
    noHouse: 'Dé una ubicación a su casa en Gladys (Configuración, Viviendas).',
    outside:
      'Sus casas están fuera de los Países Bajos: el Stookwijzer solo cubre los Países Bajos.',
    down: 'El servicio geográfico del RIVM no responde: el consejo volverá con él.',
  },
};

// Dashboard widget.
export const WIDGET_TEXT = {
  en: {
    now: 'Now',
    provisional: 'provisional',
    windForce: 'Wind (Bft)',
    lki: 'LKI',
    postcode: ({ postcode }) => `Postcode area ${postcode} · RIVM Stookwijzer`,
    noDevice: 'Add the Stookwijzer device of your house in the Discover tab.',
    noData: 'No advice yet: the RIVM geo service has not answered.',
    outside: 'This house is outside the Netherlands: no Stookwijzer advice.',
    open: 'Stookwijzer',
  },
  fr: {
    now: 'Maintenant',
    provisional: 'provisoire',
    windForce: 'Vent (Bft)',
    lki: 'LKI',
    postcode: ({ postcode }) => `Code postal ${postcode} · RIVM Stookwijzer`,
    noDevice: "Ajoutez l'appareil Stookwijzer de votre maison dans l'onglet Découverte.",
    noData: "Pas encore d'avis : le service géographique du RIVM n'a pas répondu.",
    outside: "Cette maison est hors des Pays-Bas : pas d'avis Stookwijzer.",
    open: 'Stookwijzer',
  },
  de: {
    now: 'Jetzt',
    provisional: 'vorläufig',
    windForce: 'Wind (Bft)',
    lki: 'LKI',
    postcode: ({ postcode }) => `Postleitzahl ${postcode} · RIVM Stookwijzer`,
    noDevice: 'Füge das Stookwijzer-Gerät deines Hauses im Tab „Entdecken“ hinzu.',
    noData: 'Noch kein Rat: Der Geodienst des RIVM hat nicht geantwortet.',
    outside: 'Dieses Haus liegt außerhalb der Niederlande: kein Stookwijzer-Rat.',
    open: 'Stookwijzer',
  },
  es: {
    now: 'Ahora',
    provisional: 'provisional',
    windForce: 'Viento (Bft)',
    lki: 'LKI',
    postcode: ({ postcode }) => `Código postal ${postcode} · RIVM Stookwijzer`,
    noDevice: 'Añada el dispositivo Stookwijzer de su casa en la pestaña Descubrir.',
    noData: 'Aún no hay consejo: el servicio geográfico del RIVM no ha respondido.',
    outside: 'Esta casa está fuera de los Países Bajos: no hay consejo Stookwijzer.',
    open: 'Stookwijzer',
  },
};

/** A multi-language object from one entry of a table. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const entry = table[language][key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

/** One text of a table in one language (English when unknown). */
export function text(table, language, key, params = {}) {
  const entry = (table[language] ?? table.en)[key];
  return typeof entry === 'function' ? entry(params) : entry;
}

/** "Orange: Better not to burn wood now", for the text feature. */
export function adviceSentence(language, code) {
  return `${text(CODE_NAMES, language, code)}: ${text(ADVICE, language, code)}`;
}
