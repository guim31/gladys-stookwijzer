# Stookwijzer for Gladys Assistant

A [Gladys Assistant](https://gladysassistant.com) external integration that
brings the **Stookwijzer** of the [RIVM](https://www.rivm.nl) — the official
Dutch advice on whether to light a wood stove or fireplace without bothering the
neighbourhood — to each of your houses.

> Netherlands only. Not affiliated with the RIVM.

## What it does

For each house of Gladys located in the Netherlands, one device with:

- the **current advice** of its 4-digit postcode area, as a risk level (1
  yellow, 2 orange, 3 red) and in words;
- the advice of the **next three 6-hour blocks** (04-10, 10-16, 16-22, 22-04,
  Dutch time; the next block is final, the two after are provisional);
- the **wind speed** (m/s), the **wind force** (Beaufort) and the **air quality
  index** (LKI, 1-11) the advice is based on.

Plus a **dashboard widget** (advice now and for the next blocks, wind, LKI)
and three **scene triggers**: code red, end of code red, code red announced
for the next block.

The data is read once an hour from the RIVM open geo service
(`data.rivm.nl/geo/alo`, layer `stookwijzer_v2`): no account, no key.

### The RIVM codes

As published by the RIVM (Informatiepunt Leefomgeving, "Houtstook: de
Stookwijzer"):

| Code   | Advies (nl)                                                 | Situatie postcodegebied                                                   |
| ------ | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| Geel   | Let op: stoken zorgt voor overlast en luchtverontreiniging. | Windkracht is 3 of hoger en de LKI-PM2,5 geeft een waarde van 3 of minder |
| Oranje | Het is beter nu geen hout te stoken                         | Windkracht is 3 of hoger en de LKI-PM2,5 geeft een waarde van 4,5 of 6    |
| Rood   | Stook geen hout                                             | Windkracht is 2 of lager, of de LKI-PM2,5 geeft een waarde van 7 of hoger |

"Helemaal geen hout stoken, is het beste voor een gezonde leefomgeving.
Daarom is code groen bewust niet opgenomen in de Stookwijzer." There is no
code green on purpose.

## Requirements

- Gladys Assistant **5.1.0** or later.
- A house with a location in Gladys, in the Netherlands. The integration asks
  for access to the location of your houses (manifest `location: true`).

## Installation

In Gladys: **Integrations → Install from GitHub**, then enter
`https://github.com/guim31/gladys-stookwijzer`. Pick the language of the
feature names in the Configuration tab, then add the device of your house in
the Discover tab.

User documentation: [English](docs/en.md), [Français](docs/fr.md),
[Deutsch](docs/de.md), [Español](docs/es.md).

## Limits

- Netherlands only (4-digit postcode areas).
- The advice comes from model calculations (wind from the KNMI, LKI from the
  RIVM) and may differ from local conditions.
- Developed with the real RIVM data; on the day of development every area was
  yellow, so the orange and red cases are tested on modified recordings.
  Feedback welcome.

## Development

```bash
npm ci
npm run format:check && npm run lint && npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
```

See [CLAUDE.md](CLAUDE.md) for the architecture and the project rules.

## Credits

- Data: [RIVM Stookwijzer](https://www.atlasleefomgeving.nl/stookwijzer), open
  geo service of the RIVM.
- The Home Assistant
  [Stookwijzer integration](https://www.home-assistant.io/integrations/stookwijzer/)
  (Apache 2.0) and its library
  [`stookwijzer`](https://github.com/fwestenberg/stookwijzer) by fwestenberg
  (MIT) showed the way to the data; the WGS84 → RD New conversion is the
  approximation of Schreutelkamp and Strang van Hees they also use. No code is
  copied.

Not affiliated with, nor endorsed by, the RIVM.

## License

[Apache-2.0](LICENSE)
