export function toIst(date = new Date()) {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const istOffset = (5.5 * 60 * 60000); // +5:30
  return new Date(utc + istOffset);
}

export function istDateString(date = new Date()) {
  return toIst(date).toISOString().slice(0, 10);
}

export function istISOString(date = new Date()) {
  const d = toIst(date);
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}+05:30`;
}

export default { toIst, istDateString, istISOString };
