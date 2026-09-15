import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import classNames from '../../../utils/cn.js';

function FaqItem({ faq, open, onToggle }) {
  return (
    <div className="border-b border-[var(--color-border)] py-4">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <span className="font-medium text-sm text-[var(--color-ink)]">
          {faq.question}
        </span>
        <ChevronDown
          size={18}
          className={classNames(
            'shrink-0 text-[var(--color-ink-faint)] transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <p className="text-sm text-[var(--color-ink-soft)] mt-2.5 leading-relaxed">
          {faq.answer}
        </p>
      )}
    </div>
  );
}

// `faqs` is the raw GET /api/faqs response passed down from LandingPage.
// Renders nothing if there are none — no invented FAQ content.
export default function Faqs({ faqs }) {
  const [openId, setOpenId] = useState(null);

  if (!faqs || faqs.length === 0) return null;

  return (
    <section id="faq" className="bg-[var(--color-surface)] border-y border-[var(--color-border)]">
      <div className="max-w-3xl mx-auto px-4 lg:px-6 py-16 lg:py-24">
        <h2 className="font-display font-semibold text-2xl lg:text-[32px] text-[var(--color-ink)]">
          Frequently asked questions
        </h2>
        <div className="mt-8">
          {faqs.map((faq) => (
            <FaqItem
              key={faq.faq_id}
              faq={faq}
              open={openId === faq.faq_id}
              onToggle={() => setOpenId((id) => (id === faq.faq_id ? null : faq.faq_id))}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
