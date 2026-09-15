import { AppError } from "../middlewares/errorHandler.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";

function partsFor(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function assertValidTimeZone(timeZone) {
  if (!timeZone || typeof timeZone !== "string") {
    throw new AppError("Tenant TIMEZONE setting is required for payroll.", HTTP_STATUS.UNPROCESSABLE_ENTITY);
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
  } catch {
    throw new AppError("Tenant TIMEZONE setting is invalid.", HTTP_STATUS.UNPROCESSABLE_ENTITY);
  }
  return timeZone;
}

function offsetMilliseconds(date, timeZone) {
  const parts = partsFor(date, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

function localMidnightToUtc(year, month, day, timeZone) {
  const localWallTime = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = localWallTime;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const next = localWallTime - offsetMilliseconds(new Date(guess), timeZone);
    if (next === guess) break;
    guess = next;
  }
  return new Date(guess);
}

export function payrollPeriod(month, timeZone) {
  assertValidTimeZone(timeZone);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || "")) {
    throw new AppError("Payroll month must use YYYY-MM format.", HTTP_STATUS.BAD_REQUEST);
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonthDate = new Date(Date.UTC(year, monthNumber, 1));
  const nextYear = nextMonthDate.getUTCFullYear();
  const nextMonth = nextMonthDate.getUTCMonth() + 1;
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const localStartDate = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
  const localEndDateExclusive = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  return {
    month,
    timezone: timeZone,
    daysInMonth,
    localStartDate,
    localEndDateExclusive,
    startUtc: localMidnightToUtc(year, monthNumber, 1, timeZone),
    endUtc: localMidnightToUtc(nextYear, nextMonth, 1, timeZone),
  };
}

export function dateKey(value) {
  if (typeof value === "string") return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

export function enumerateDateKeys(startDate, endDateExclusive) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDateExclusive}T00:00:00Z`);
  while (cursor < end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}
