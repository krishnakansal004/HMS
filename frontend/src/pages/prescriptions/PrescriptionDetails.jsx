import Modal from '../../components/ui/Modal.jsx';
import StatusPill from '../../components/ui/StatusPill.jsx';
import { formatDateTime, fullName, splitPrescriptionNotes } from '../../utils/format.js';

export default function PrescriptionDetails({ open, onClose, prescription }) {
  if (!prescription) return null;

  const { diagnosis, instructions } = splitPrescriptionNotes(prescription.notes);
  const items = Array.isArray(prescription.medicines) ? prescription.medicines : [];
  const doctorName = prescription.doctor_profile?.users?.name;

  return (
    <Modal open={open} onClose={onClose} title="Prescription" size="lg">
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs text-[var(--color-ink-faint)]">Patient</p>
            <p className="text-sm font-medium text-[var(--color-ink)]">{fullName(prescription.patient)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-ink-faint)]">Prescribing doctor</p>
            <p className="text-sm font-medium text-[var(--color-ink)]">{doctorName || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-ink-faint)]">Status</p>
            <StatusPill status={prescription.approval_status} />
          </div>
          <div>
            <p className="text-xs text-[var(--color-ink-faint)]">Created</p>
            <p className="text-sm text-[var(--color-ink)]">{formatDateTime(prescription.created_at)}</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-[var(--color-ink)] mb-1">Diagnosis</h4>
          <p className="text-sm text-[var(--color-ink-soft)]">{diagnosis}</p>
        </div>

        {instructions && (
          <div>
            <h4 className="text-sm font-semibold text-[var(--color-ink)] mb-1">General instructions</h4>
            <p className="text-sm text-[var(--color-ink-soft)] whitespace-pre-wrap">{instructions}</p>
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-[var(--color-ink)] mb-2">Medicines</h4>
          <div className="flex flex-col gap-2">
            {items.length === 0 && (
              <p className="text-sm text-[var(--color-ink-faint)]">No medicines recorded.</p>
            )}
            {items.map((item, i) => (
              <div key={i} className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-[var(--color-ink)]">{item.name}</p>
                  <p className="text-xs text-[var(--color-ink-faint)]">{item.duration} day{item.duration === 1 ? '' : 's'}</p>
                </div>
                <p className="text-xs text-[var(--color-ink-soft)] mt-1">
                  {item.dosage} &middot; {item.frequency}
                </p>
                {item.instructions && (
                  <p className="text-xs text-[var(--color-ink-faint)] mt-1">{item.instructions}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
