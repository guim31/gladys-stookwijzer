// -----------------------------------------------------------------------------
// WGS84 (latitude, longitude of the Gladys house) to RD New (EPSG:28992), the
// Dutch grid the RIVM geo service is queried in.
//
// The approximation of Schreutelkamp and Strang van Hees ("Benaderingsformules
// voor de transformatie tussen RD- en WGS84-kaartcoördinaten", 2001), the one
// the Python `stookwijzer` library of Home Assistant uses: about a metre off
// inside the Netherlands, far below the size of a 4-digit postcode area.
// -----------------------------------------------------------------------------

// Reference point: the Onze Lieve Vrouwetoren of Amersfoort.
const X0 = 155000;
const Y0 = 463000;
const PHI0 = 52.1551744;
const LAMBDA0 = 5.38720621;

// [p, q, coefficient]: X += c · dφ^p · dλ^q
const R = [
  [0, 1, 190094.945],
  [1, 1, -11832.228],
  [2, 1, -114.221],
  [0, 3, -32.391],
  [1, 0, -0.705],
  [3, 1, -2.34],
  [1, 3, -0.608],
  [0, 2, -0.008],
  [2, 3, 0.148],
];

// [p, q, coefficient]: Y += c · dφ^p · dλ^q
const S = [
  [1, 0, 309056.544],
  [0, 2, 3638.893],
  [2, 0, 73.077],
  [1, 2, -157.984],
  [3, 0, 59.788],
  [0, 1, 0.433],
  [2, 2, -6.439],
  [1, 1, -0.032],
  [0, 4, 0.092],
  [1, 4, -0.054],
];

/**
 * @param {number} latitude degrees
 * @param {number} longitude degrees
 * @returns {{ x: number, y: number }} metres, rounded to the metre
 */
export function toRdNew(latitude, longitude) {
  const dPhi = 0.36 * (latitude - PHI0);
  const dLambda = 0.36 * (longitude - LAMBDA0);
  const sum = (terms) =>
    terms.reduce((total, [p, q, c]) => total + c * dPhi ** p * dLambda ** q, 0);
  return { x: Math.round(X0 + sum(R)), y: Math.round(Y0 + sum(S)) };
}

// A generous box around the Netherlands (WGS84): outside, the RIVM layer has
// no postcode area and the house is told so without asking.
export function nearTheNetherlands(latitude, longitude) {
  return latitude >= 50.6 && latitude <= 53.8 && longitude >= 3.2 && longitude <= 7.4;
}
