// Money fields on invoices (amount/discount/unitPrice) are integers in
// minor currency units per invoiceValidator.js ("isInt ... in minor
// currency"). We assume paise (INR) matching the rest of the codebase
// (Razorpay integration elsewhere works in paise). Never do float math
// on these — keep everything as integers until the final render step.
export function formatPaise(paise) {
  if (paise === null || paise === undefined || Number.isNaN(Number(paise))) return '—';
  const rupees = Number(paise) / 100;
  return rupees.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
}

export function toPaise(value) {
  const normalized = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new Error('Enter a valid amount with no more than two decimal places.');
  }
  const [whole, fraction = ''] = normalized.split('.');
  const paise = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (paise > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Amount is too large.');
  }
  return Number(paise);
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fullName(entity, first = 'first_name', last = 'last_name') {
  if (!entity) return '—';
  return [entity[first], entity[last]].filter(Boolean).join(' ') || '—';
}

// Prescriptions have no dedicated `diagnosis` column — the backend folds it
// into `notes` as "Diagnosis: <text>\n\n<instructions>". Split it back out
// for display; falls back gracefully if the prefix isn't there.
export function splitPrescriptionNotes(notes) {
  if (!notes) return { diagnosis: '—', instructions: '' };
  const match = notes.match(/^Diagnosis:\s*([^\n]*)\n?\n?([\s\S]*)$/);
  if (!match) return { diagnosis: notes, instructions: '' };
  return { diagnosis: match[1] || '—', instructions: match[2] || '' };
}

export function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
