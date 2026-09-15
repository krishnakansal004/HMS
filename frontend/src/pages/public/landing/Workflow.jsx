import { WORKFLOW_STEPS } from './content.js';

export default function Workflow() {
  return (
    <section className="max-w-6xl mx-auto px-4 lg:px-6 py-16 lg:py-24">
      <div className="max-w-2xl">
        <h2 className="font-display font-semibold text-2xl lg:text-[32px] text-[var(--color-ink)]">
          Getting started
        </h2>
      </div>

      <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
        {WORKFLOW_STEPS.map((step, i) => (
          <li key={step.title} className="relative">
            <span className="font-display font-semibold text-3xl text-[var(--color-primary-soft)]">
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="font-display font-semibold text-[15px] text-[var(--color-ink)] mt-2">
              {step.title}
            </h3>
            <p className="text-sm text-[var(--color-ink-soft)] mt-1.5 leading-relaxed">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
