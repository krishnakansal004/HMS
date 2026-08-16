import { Construction } from 'lucide-react';
import Card, { CardBody } from '../components/ui/Card.jsx';

export default function ComingSoon({ moduleName, phase }) {
  return (
    <Card>
      <CardBody className="flex flex-col items-center text-center gap-3 py-16">
        <div className="h-11 w-11 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] flex items-center justify-center">
          <Construction size={20} />
        </div>
        <h2 className="font-display font-semibold text-lg text-[var(--color-ink)]">{moduleName} is on the roadmap</h2>
        <p className="text-sm text-[var(--color-ink-soft)] max-w-md">
          The API layer for this module is already wired (see <code className="font-mono-data text-xs bg-[var(--color-paper)] px-1 py-0.5 rounded">src/api/</code>) —
          the screen itself is scheduled for {phase || 'a later phase'}.
        </p>
      </CardBody>
    </Card>
  );
}
