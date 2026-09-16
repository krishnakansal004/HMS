import { ArrowRight } from 'lucide-react';
import Button from '../../../components/ui/Button.jsx';
import { scrollToSection } from '../../../utils/scrollToSection.js';

function DashboardPreview() {
  const rows = [
    { name: 'A. Sharma', dept: 'Cardiology', status: 'Admitted', tone: 'var(--color-info)' },
    { name: 'R. Iyer', dept: 'Orthopedics', status: 'Waiting', tone: 'var(--color-warning)' },
    { name: 'M. Verma', dept: 'General', status: 'Discharged', tone: 'var(--color-success)' },
  ];
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_8px_30px_rgba(18,24,38,0.08)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-paper)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-danger)]/50" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-warning)]/50" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-success)]/50" />
        <span className="ml-3 text-xs font-medium text-[var(--color-ink-faint)] font-mono-data">
          your-hospital.hms.app/dashboard
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 p-4 border-b border-[var(--color-border)]">
        {[
          ['Today\u2019s appointments', '18'],
          ['Beds occupied', '42 / 60'],
          ['Pending invoices', '7'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[var(--radius-md)] bg-[var(--color-paper)] border border-[var(--color-border)] p-3">
            <p className="text-[11px] text-[var(--color-ink-faint)] leading-tight">{label}</p>
            <p className="font-mono-data font-semibold text-lg text-[var(--color-ink)] mt-1">{value}</p>
          </div>
        ))}
      </div>
      <div className="p-4">
        <p className="text-[11px] font-medium text-[var(--color-ink-faint)] uppercase tracking-wide mb-2">
          Recent patients
        </p>
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <div
              key={r.name}
              className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-ink)] truncate">{r.name}</p>
                <p className="text-xs text-[var(--color-ink-faint)]">{r.dept}</p>
              </div>
              <span
                className="inline-flex items-center gap-1.5 text-xs font-medium shrink-0 ml-2"
                style={{ color: r.tone }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.tone }} />
                {r.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 lg:px-6 pt-14 pb-20 lg:pt-20 lg:pb-28 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-flex items-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-ink-soft)]">
            Multi-hospital HMS platform
          </span>
          <h1 className="font-display font-semibold text-4xl lg:text-5xl text-[var(--color-ink)] leading-[1.08] mt-5">
            One connected platform for your hospital's everyday operations.
          </h1>
          <p className="text-base lg:text-lg text-[var(--color-ink-soft)] mt-5 max-w-lg leading-relaxed">
            Manage patients, appointments, admissions, billing, pharmacy inventory, and staff
            from a single workspace — with each role seeing exactly what their job needs, and
            nothing more.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Button size="lg" icon={ArrowRight} className="flex-row-reverse" onClick={() => scrollToSection('register')}>
              Register your hospital
            </Button>
            <Button variant="secondary" size="lg" onClick={() => scrollToSection('features')}>See what's included</Button>
          </div>
          <p className="text-xs text-[var(--color-ink-faint)] mt-4">
            Already using HMS at your hospital?{' '}
            <a href="/login" className="text-[var(--color-primary)] font-medium hover:underline">
              Sign in
            </a>
          </p>
        </div>

        <div className="relative">
          <div
            className="absolute -inset-6 -z-10 rounded-[var(--radius-lg)] opacity-60"
            style={{
              background:
                'radial-gradient(60% 60% at 70% 20%, var(--color-primary-soft), transparent 70%)',
            }}
            aria-hidden="true"
          />
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
