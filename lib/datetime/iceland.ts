const ICELANDIC_LOCALE = "is-IS";
export const ICELAND_TIME_ZONE = "Atlantic/Reykjavik";

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

export function icelandicDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: ICELAND_TIME_ZONE,
  }).formatToParts(asDate(value));
  const year = numericPart(parts, "year");
  const month = numericPart(parts, "month").toString().padStart(2, "0");
  const day = numericPart(parts, "day").toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyAsUtc(value: string | Date) {
  const [year, month, day] = icelandicDateKey(value).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function compareIcelandicDays(value: string | Date, reference: string | Date) {
  return Math.round((dateKeyAsUtc(value) - dateKeyAsUtc(reference)) / 86_400_000);
}

export function isPastInstant(value: string | Date, now: string | Date = new Date()) {
  return asDate(value).getTime() < asDate(now).getTime();
}

export function getIcelandicDayRange(now: string | Date = new Date()) {
  const key = icelandicDateKey(now);
  // Iceland remains on UTC year-round, while the date key itself is resolved
  // explicitly in Atlantic/Reykjavik above.
  return { start: `${key}T00:00:00.000Z`, end: `${key}T23:59:59.999Z` };
}

export function formatIcelandicRelativeDay(value: string | Date, now: string | Date = new Date()) {
  const difference = compareIcelandicDays(value, now);
  if (difference === 0) return "Í dag";
  if (difference === 1) return "Á morgun";
  if (difference === -1) return "Í gær";
  return formatIcelandicDateWithYear(value);
}

export function formatOfferValidity(value: string | Date, now: string | Date = new Date()) {
  if (isPastInstant(value, now)) {
    return { expired: true, label: `Gildistími liðinn · ${formatIcelandicDate(value)} kl. ${formatIcelandicTime(value)}` };
  }
  const difference = compareIcelandicDays(value, now);
  if (difference === 0) return { expired: false, label: `Gildir til í dag kl. ${formatIcelandicTime(value)}` };
  if (difference === 1) return { expired: false, label: `Gildir til á morgun kl. ${formatIcelandicTime(value)}` };
  return { expired: false, label: `Gildir til ${formatIcelandicDateWithYear(value)} · ${formatIcelandicTime(value)}` };
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
