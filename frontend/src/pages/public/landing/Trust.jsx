import { TRUST_POINTS } from './content.js';

export default function Trust() {
  return (
    <section className="bg-[var(--color-ink)] text-white">
      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-16 lg:py-24">
        <div className="max-w-2xl">
          <h2 className="font-display font-semibold text-2xl lg:text-[32px]">
            Built with tenant and access boundaries as first-class concerns
          </h2>
          <p className="text-white/60 mt-3 text-base">
            Precise, not exaggerated — this is what the platform actually implements.
          </p>
        </div>

        <div className="grid sm:grid-cols-3 gap-6 mt-10">
          {TRUST_POINTS.map(({ icon: Icon, title, description }) => (
            <div key={title}>
              <div className="h-9 w-9 rounded-[var(--radius-sm)] bg-white/10 flex items-center justify-center">
                <Icon size={18} />
              </div>
              <h3 className="font-display font-semibold text-[15px] mt-4">{title}</h3>
              <p className="text-sm text-white/60 mt-1.5 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
