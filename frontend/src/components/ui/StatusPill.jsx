import classNames from '../../utils/cn.js';

// The one visual idiom that repeats identically across every module:
// patient state, bed state, invoice state, claim state, lab/radiology
// order state. A colored dot + label, same shape everywhere, so the app
// reads as one system rather than nineteen independently designed screens.

const TONES = {
  neutral: { dot: 'bg-[var(--color-ink-faint)]', text: 'text-[var(--color-ink-soft)]', bg: 'bg-[var(--color-paper)]' },
  primary: { dot: 'bg-[var(--color-primary)]', text: 'text-[var(--color-primary-ink)]', bg: 'bg-[var(--color-primary-soft)]' },
  success: { dot: 'bg-[var(--color-success)]', text: 'text-[var(--color-success)]', bg: 'bg-[var(--color-success-soft)]' },
  warning: { dot: 'bg-[var(--color-warning)]', text: 'text-[var(--color-warning)]', bg: 'bg-[var(--color-warning-soft)]' },
  danger: { dot: 'bg-[var(--color-danger)]', text: 'text-[var(--color-danger)]', bg: 'bg-[var(--color-danger-soft)]' },
  accent: { dot: 'bg-[var(--color-accent)]', text: 'text-[var(--color-accent)]', bg: 'bg-[var(--color-accent-soft)]' },
};

const STATUS_TONE_MAP = {
  // appointments — lowercase, matching chk_appointment_status
  confirmed: 'primary', checked_in: 'accent', in_progress: 'accent', no_show: 'danger',
  // admissions — lowercase, matching chk_admission_status
  admitted: 'primary', discharged: 'success', transferred: 'accent',
  // invoices
  draft: 'neutral', pending: 'warning', partial: 'accent', paid: 'success', cancelled: 'danger',
  // lab / radiology
  pending: 'warning', collected: 'accent', processing: 'accent', ordered: 'warning',
  scheduled: 'accent', scanning: 'accent', completed: 'success', cancelled: 'danger',
  // insurance claims
  submitted: 'warning', under_review: 'accent', approved: 'success', rejected: 'danger', settled: 'success',
  // purchases
  received: 'success',
  // attendance
  PRESENT: 'success', LEAVE: 'warning', HALF_DAY: 'accent',
};

export default function StatusPill({ status, tone, label }) {
  const resolvedTone = tone || STATUS_TONE_MAP[status] || 'neutral';
  const t = TONES[resolvedTone] || TONES.neutral;
  const text = label || (status ? status.replace(/_/g, ' ') : '—');
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize',
        t.bg,
        t.text
      )}
    >
      <span className={classNames('h-1.5 w-1.5 rounded-full', t.dot)} />
      {text}
    </span>
  );
}
