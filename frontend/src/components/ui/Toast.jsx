import { create } from 'zustand';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

let idCounter = 0;

export const useToastStore = create((set, get) => ({
  toasts: [],
  push(toast) {
    const id = ++idCounter;
    set({ toasts: [...get().toasts, { id, ...toast }] });
    setTimeout(() => get().dismiss(id), toast.duration || 4500);
    return id;
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  success: (message) => useToastStore.getState().push({ type: 'success', message }),
  error: (message) => useToastStore.getState().push({ type: 'error', message }),
  info: (message) => useToastStore.getState().push({ type: 'info', message }),
};

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const TONES = {
  success: 'bg-[var(--color-success-soft)] text-[var(--color-success)] border-[var(--color-success)]/20',
  error: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)] border-[var(--color-danger)]/20',
  info: 'bg-[var(--color-info-soft)] text-[var(--color-info)] border-[var(--color-info)]/20',
};

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div
            key={t.id}
            role="status"
            className={`flex items-start gap-2.5 rounded-[var(--radius-md)] border px-4 py-3 text-sm shadow-lg ${TONES[t.type] || TONES.info}`}
          >
            <Icon size={18} className="shrink-0 mt-0.5" />
            <p className="flex-1">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
