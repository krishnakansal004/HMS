import { Check } from 'lucide-react';
import { ROLE_VALUE } from './content.js';

export default function Roles() {
  return (
    <section id="roles" className="bg-[var(--color-surface)] border-y border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-16 lg:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display font-semibold text-2xl lg:text-[32px] text-[var(--color-ink)]">
            Built around who's actually using it
          </h2>
          <p className="text-[var(--color-ink-soft)] mt-3 text-base">
            Fourteen roles in total — access is scoped server-side, not just hidden in the menu.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 mt-10">
          {ROLE_VALUE.map(({ icon: Icon, role, points }) => (
            <div
              key={role}
              className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-5"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-[var(--radius-sm)] bg-[var(--color-accent-soft)] text-[var(--color-accent)] flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </div>
                <h3 className="font-display font-semibold text-[15px] text-[var(--color-ink)]">
                  {role}
                </h3>
              </div>
              <ul className="mt-4 flex flex-col gap-2">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
                    <Check size={15} className="text-[var(--color-success)] mt-0.5 shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
