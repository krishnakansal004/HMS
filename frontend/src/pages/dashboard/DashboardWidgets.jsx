import { Link } from 'react-router-dom';
import { ArrowUpRight, Construction, History, FlaskConical, Scan, Receipt, CalendarClock, BedDouble, FileStack } from 'lucide-react';
import Card, { CardBody } from '../../components/ui/Card.jsx';
import { Spinner, ErrorState } from '../../components/ui/Table.jsx';

export function StatCard({ icon: Icon, label, state, value, suffix, to }) {
  return (
    <Card>
      <CardBody>
        {state.loading ? (
          <Spinner label={`Loading...`} />
        ) : state.error ? (
          <ErrorState message={state.error} onRetry={state.refetch} />
        ) : (
          <Link to={to} className="flex items-center justify-between group">
            <div>
              <p className="text-xs font-medium text-[var(--color-ink-soft)] uppercase tracking-wide">{label}</p>
              <p className="font-display text-3xl font-semibold text-[var(--color-ink)] mt-1">
                {value ?? '--'}
                {suffix && <span className="text-base font-medium text-[var(--color-ink-soft)] ml-1.5">{suffix}</span>}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">
                <Icon size={18} />
              </div>
              <ArrowUpRight size={14} className="text-[var(--color-ink-faint)] group-hover:text-[var(--color-primary)] transition-colors" />
            </div>
          </Link>
        )}
      </CardBody>
    </Card>
  );
}

const ATTENTION_TONES = {
  danger: { bg: 'bg-[var(--color-danger-soft)]', text: 'text-[var(--color-danger)]' },
  warning: { bg: 'bg-[var(--color-warning-soft)]', text: 'text-[var(--color-warning)]' },
  accent: { bg: 'bg-[var(--color-accent-soft)]', text: 'text-[var(--color-accent)]' },
};

export function AttentionRow({ icon: Icon, tone, label, state, to, value, render }) {
  const t = ATTENTION_TONES[tone] || ATTENTION_TONES.accent;
  return (
    <Link to={to} className="flex flex-col gap-1 group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
          <div className={`h-7 w-7 rounded-full flex items-center justify-center ${t.bg} ${t.text}`}>
            <Icon size={14} />
          </div>
          {label}
        </div>
        {state.loading ? (
          <span className="text-xs text-[var(--color-ink-faint)]">...</span>
        ) : state.error ? (
          <span className="text-xs text-[var(--color-danger)]">error</span>
        ) : value !== undefined ? (
          <span className="font-mono-data text-sm font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-primary)]">{value}</span>
        ) : null}
      </div>
      {render && !state.loading && !state.error && render()}
    </Link>
  );
}

export function RoadmapNote() {
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] flex items-center justify-center">
          <Construction size={16} />
        </div>
        <div>
          <p className="font-medium text-sm text-[var(--color-ink)]">More dashboard widgets are coming with later phases</p>
          <p className="text-xs text-[var(--color-ink-soft)] mt-1 max-w-2xl">
            A 7-day admissions/discharge trend, a live activity feed, and a full multi-department
            staff roster all need backend work that isn't live yet. They'll be added here as each phase ships.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

export function TimelineIcon({ type }) {
  const ICONS = {
    Prescription: <FileStack size={14}/>,
    Lab: <FlaskConical size={14}/>,
    Radiology: <Scan size={14}/>
  };
  return (
    <div className="h-8 w-8 rounded-full border shadow-sm flex items-center justify-center bg-white text-[var(--color-ink-soft)] border-[var(--color-border-strong)] z-10">
      {ICONS[type] || <History size={14}/>}
    </div>
  );
}