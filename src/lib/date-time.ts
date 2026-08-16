export function formatInTimeZone(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Ungültige Zeit";
  return new Intl.DateTimeFormat("de-CH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export function dateKeyInTimeZone(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone }).formatToParts(date);
  const part = (type: "year" | "month" | "day") => parts.find(valuePart => valuePart.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function dateTimeLocalInTimeZone(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }).formatToParts(date);
  const part = (type: "year" | "month" | "day" | "hour" | "minute") => parts.find(valuePart => valuePart.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function zonedDateTimeToUtc(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Ungültiges Datum");
  const desired = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
  let guess = desired;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const rendered = dateTimeLocalInTimeZone(new Date(guess), timeZone);
    const renderedMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(rendered);
    if (!renderedMatch) break;
    const renderedUtc = Date.UTC(Number(renderedMatch[1]), Number(renderedMatch[2]) - 1, Number(renderedMatch[3]), Number(renderedMatch[4]), Number(renderedMatch[5]));
    guess += desired - renderedUtc;
  }
  return new Date(guess);
}
