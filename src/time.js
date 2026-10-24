// -----------------------------------------------------------------------------
// The Stookwijzer speaks Dutch local time: `model_runtime` ("24-10-2026 04:00")
// is the start of the current 6-hour block in Europe/Amsterdam (the blocks
// start at 04:00, 10:00, 16:00 and 22:00 local time, summer and winter alike).
// These helpers turn it into real instants and format hours in the time zone
// of Gladys (TZ), without a date library.
// -----------------------------------------------------------------------------

export const SOURCE_TIME_ZONE = 'Europe/Amsterdam';

/** Offset of a time zone at an instant, in minutes east of UTC. */
function offsetMinutes(timeZone, instant) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(instant)
      .map(({ type, value }) => [type, value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * A Dutch wall-clock time to an instant. Out-of-range fields roll over
 * (hour 28 is 04:00 the next day), as with Date.UTC.
 */
export function dutchTime(year, month, day, hour, minute = 0) {
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  // Two passes settle the offset, also next to a daylight saving change.
  let instant = wallClock - offsetMinutes(SOURCE_TIME_ZONE, new Date(wallClock)) * 60000;
  instant = wallClock - offsetMinutes(SOURCE_TIME_ZONE, new Date(instant)) * 60000;
  return new Date(instant);
}

/**
 * "DD-MM-YYYY HH:MM" (Dutch time) to its fields, or null when unreadable.
 * @param {string} text
 */
export function runtimeFields(text) {
  const match = /^(\d{2})-(\d{2})-(\d{4}) (\d{2}):(\d{2})$/.exec(String(text ?? '').trim());
  if (!match) {
    return null;
  }
  const [, day, month, year, hour, minute] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }
  return { year, month, day, hour, minute };
}

/** "DD-MM-YYYY HH:MM" (Dutch time) to a Date, or null when unreadable. */
export function parseRuntime(text) {
  const f = runtimeFields(text);
  return f ? dutchTime(f.year, f.month, f.day, f.hour, f.minute) : null;
}

/** "16:00" in the given time zone (TZ of Gladys by default). */
export function formatHour(date, timeZone = process.env.TZ || SOURCE_TIME_ZONE) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: SOURCE_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  }
}
