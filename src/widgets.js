// -----------------------------------------------------------------------------
// Dashboard widget "Stookwijzer": the advice of one house now and for the next
// blocks, the wind force and the air quality index (live tiles bound to the
// device), and a link to the official Stookwijzer page.
//
// Budget of the core: 8 components, 2 texts. Here: 2 texts, 2 tiles, 1 status,
// 1 button.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { CODES } from './api.js';
import { houseIds, selectorOfId } from './devices.js';
import { WIDGET_KEY } from './monitor.js';
import { ADVICE, CODE_NAMES, WIDGET_TEXT, text } from './texts.js';
import { formatHour } from './time.js';

export const STOOKWIJZER_URL = 'https://www.atlasleefomgeving.nl/stookwijzer';

const COLORS = {
  yellow: WIDGET_COLORS.NEUTRAL,
  orange: WIDGET_COLORS.WARNING,
  red: WIDGET_COLORS.DANGER,
};

const message = (body) => ({ ttl_seconds: 600, components: [{ type: 'text', text: body }] });

/**
 * @param {import('./monitor.js').Monitor} monitor
 * @param {{ settings?: object, language?: string }} request
 */
export function stookwijzerContent(monitor, { settings = {}, language = 'en' } = {}) {
  const lang = WIDGET_TEXT[language] ? language : 'en';
  const t = (key, params) => text(WIDGET_TEXT, lang, key, params);
  const created = (monitor.gladys.devices ?? [])
    .map((device) => selectorOfId(monitor.gladys, device.external_id))
    .filter(Boolean);
  const wanted = selectorOfId(monitor.gladys, settings.house);
  const selector = created.includes(wanted) ? wanted : created[0];
  if (!selector) {
    return message(t('noDevice'));
  }
  const view = monitor.view(selector);
  if (view?.outside) {
    return message(t('outside'));
  }
  const current = view?.blocks?.[0];
  if (!current || current.code === null) {
    return message(t('noData'));
  }

  const ids = houseIds(monitor.gladys, selector);
  const items = view.blocks.slice(0, 4).flatMap((block, index) => {
    if (block.code === null) {
      return [];
    }
    const code = CODES[block.code];
    const hours = `${formatHour(block.start)}–${formatHour(block.end)}`;
    const name = text(CODE_NAMES, lang, code);
    return [
      {
        label: index === 0 ? `${t('now')} · ${hours}` : hours,
        value: block.final ? name : `${name} (${t('provisional')})`,
        color: COLORS[code],
      },
    ];
  });

  return {
    // The layer changes once per block; the tiles follow the states live.
    ttl_seconds: 900,
    components: [
      { type: 'text', variant: 'body', text: text(ADVICE, lang, CODES[current.code]) },
      { type: 'value', label: t('windForce'), device_feature: ids.windForce },
      { type: 'value', label: t('lki'), device_feature: ids.lki },
      { type: 'status', items },
      {
        type: 'text',
        variant: 'caption',
        text: t('postcode', { postcode: view.advice.postcode }),
      },
      { type: 'button', label: t('open'), icon: 'external-link', link: { url: STOOKWIJZER_URL } },
    ],
  };
}

export const WIDGETS = {
  [WIDGET_KEY]: { get: stookwijzerContent },
};
