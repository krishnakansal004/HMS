import { FEATURES } from './content.js';

export default function Features() {
  return (
    <section id="features" className="max-w-6xl mx-auto px-4 lg:px-6 py-16 lg:py-24">
      <div className="max-w-2xl">
        <h2 className="font-display font-semibold text-2xl lg:text-[32px] text-[var(--color-ink)]">
          Everything your hospital already runs on, in one place
        </h2>
        <p className="text-[var(--color-ink-soft)] mt-3 text-base">
          Built as one system instead of separate tools bolted together — every module reads
          from the same patient, billing, and staff records.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <div
            key={title}
            className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">
              <Icon size={18} />
            </div>
            <h3 className="font-display font-semibold text-[15px] text-[var(--color-ink)] mt-4">
              {title}
            </h3>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1.5 leading-relaxed">
              {description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
