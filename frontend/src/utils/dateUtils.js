/**
 * Safely parses any ISO date string or timestamp into a JavaScript Date object,
 * ensuring UTC timestamps without a trailing 'Z' are correctly parsed as UTC.
 */
export function parseUtcDate(val) {
  if (!val) return new Date();
  if (val instanceof Date) return val;
  let str = String(val).trim();
  // If string contains T or space but lacks Z or +/- offset, append Z
  if ((str.includes('T') || str.includes(' ')) && !str.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function formatLocalDateTime(val) {
  return parseUtcDate(val).toLocaleString();
}

export function formatLocalTime(val) {
  return parseUtcDate(val).toLocaleTimeString();
}
