import { DateTime } from "luxon";

/**
 * Get current time in Eastern Time as a Luxon DateTime.
 */
export function getCurrentEasternTime(): DateTime {
  return DateTime.now().setZone("America/New_York");
}

/**
 * Parse HH:mm string as a DateTime on the same calendar day as `base` in ET.
 */
export function parseEtTimeOnDate(base: DateTime, time: string): DateTime {
  const [hour, minute] = time.split(":").map((x) => parseInt(x, 10));
  return base.set({ hour, minute, second: 0, millisecond: 0 });
}

/**
 * Returns true if `now` is in [start, end) interval.
 */
export function isBetweenInclusiveStartExclusiveEnd(
  now: DateTime,
  start: DateTime,
  end: DateTime
): boolean {
  return now >= start && now < end;
}
