const ICELANDIC_LOCALE = "is-IS";
const ICELAND_TIME_ZONE = "Atlantic/Reykjavik";

const icelandicMonths = [
  "janúar",
  "febrúar",
  "mars",
  "apríl",
  "maí",
  "júní",
  "júlí",
  "ágúst",
  "september",
  "október",
  "nóvember",
  "desember",
] as const;

function asDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date value");
  return date;
}

function numericPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new RangeError(`Missing ${type} date part`);
  return Number(value);
}

export function formatIcelandicDate(value: string | Date) {
  const parts = new Intl.DateTimeFormat(ICELANDIC_LOCALE, {
    day: "numeric",
    month: "numeric",
    timeZone: ICELAND_TIME_ZONE,
  }).formatToParts(asDate(value));
  const day = numericPart(parts, "day");
  const month = numericPart(parts, "month");
  return `${day}. ${icelandicMonths[month - 1]}`;
}

export function formatIcelandicDateWithYear(value: string | Date) {
  const parts = new Intl.DateTimeFormat(ICELANDIC_LOCALE, {
    day: "numeric", month: "numeric", year: "numeric", timeZone: ICELAND_TIME_ZONE,
  }).formatToParts(asDate(value));
  const day = numericPart(parts, "day");
  const month = numericPart(parts, "month");
  const year = numericPart(parts, "year");
  return `${day}. ${icelandicMonths[month - 1]} ${year}`;
}

export function formatIcelandicTime(value: string | Date) {
  const parts = new Intl.DateTimeFormat(ICELANDIC_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ICELAND_TIME_ZONE,
  }).formatToParts(asDate(value));
  const hour = numericPart(parts, "hour").toString().padStart(2, "0");
  const minute = numericPart(parts, "minute").toString().padStart(2, "0");
  return `${hour}:${minute}`;
}

export function formatViewingDateTimeRange(startsAt: string | Date, endsAt: string | Date) {
  const startDate = formatIcelandicDate(startsAt);
  const endDate = formatIcelandicDate(endsAt);
  const startTime = formatIcelandicTime(startsAt);
  const endTime = formatIcelandicTime(endsAt);

  return startDate === endDate
    ? `${startDate} · ${startTime}–${endTime}`
    : `${startDate} · ${startTime}–${endDate} ${endTime}`;
}
