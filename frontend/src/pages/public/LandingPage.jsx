import { useEffect, useState } from 'react';
import { plansApi } from '../../api/plans.js';
import { faqsApi } from '../../api/faqs.js';
import { useAsync } from '../../hooks/useAsync.js';
import { ToastViewport } from '../../components/ui/Toast.jsx';
import LandingNav from './landing/LandingNav.jsx';
import Hero from './landing/Hero.jsx';
import Features from './landing/Features.jsx';
import Roles from './landing/Roles.jsx';
import Workflow from './landing/Workflow.jsx';
import Trust from './landing/Trust.jsx';
import Plans from './landing/Plans.jsx';
import Faqs from './landing/Faqs.jsx';
import RegisterForm from './landing/RegisterForm.jsx';
import ContactForm from './landing/ContactForm.jsx';
import LandingFooter from './landing/LandingFooter.jsx';

const TITLE = 'HMS \u2014 Hospital Management System';
const DESCRIPTION =
  'One connected platform for managing patients, appointments, admissions, billing, pharmacy inventory, and staff across your hospital.';

// Basic SEO without adding a dependency (no react-helmet in this
// codebase). Restores the previous title/description on unmount so
// navigating into the authenticated app (which sets its own per-page
// title via route `handle.title` in Topbar) doesn't inherit these.
function useBasicSeo() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = TITLE;

    let meta = document.querySelector('meta[name="description"]');
    const createdMeta = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    const prevContent = meta.getAttribute('content');
    meta.setAttribute('content', DESCRIPTION);

    return () => {
      document.title = prevTitle;
      if (createdMeta) {
        meta.remove();
      } else if (prevContent !== null) {
        meta.setAttribute('content', prevContent);
      }
    };
  }, []);
}

export default function LandingPage() {
  useBasicSeo();

  // Same hook every other data-fetching page in this app uses
  // (PlansDashboard, PatientsList, etc.) — distinct cache keys from the
  // authenticated dashboard's own 'plans_list' so an anonymous visitor's
  // request never shares cache state with a logged-in session's.
  const { data: plansRes, loading: plansLoading } = useAsync(
    () => plansApi.publicList(),
    [],
    'landing_plans'
  );
  const { data: faqsRes } = useAsync(() => faqsApi.list(), [], 'landing_faqs');

  const plans = plansRes?.data || [];
  const faqs = faqsRes?.data || [];

  // Shared between Plans (sets it when someone clicks "Choose {plan}")
  // and RegisterForm (reflects it into the dropdown) so the CTA actually
  // lands the visitor on the plan they picked instead of scrolling them
  // to an empty "Select a plan..." field.
  const [selectedPlanId, setSelectedPlanId] = useState('');

  return (
    <div className="min-h-screen bg-[var(--color-paper)]">
      <LandingNav />
      <main>
        <Hero />
        <Features />
        <Roles />
        <Workflow />
        <Plans plans={plans} loading={plansLoading} onChoosePlan={setSelectedPlanId} />
        <Trust />
        <Faqs faqs={faqs} />

        <section id="register" className="max-w-6xl mx-auto px-4 lg:px-6 py-16 lg:py-24">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <h2 className="font-display font-semibold text-2xl lg:text-[32px] text-[var(--color-ink)]">
              Register your hospital
            </h2>
            <p className="text-[var(--color-ink-soft)] mt-3 text-base">
              Set up your hospital's workspace and administrator account. You can bring the
              rest of your team on right after.
            </p>
          </div>
          <RegisterForm
            plans={plans}
            plansLoading={plansLoading}
            selectedPlanId={selectedPlanId}
            onPlanChange={setSelectedPlanId}
          />
        </section>

        <section id="contact" className="bg-[var(--color-surface)] border-t border-[var(--color-border)]">
          <div className="max-w-6xl mx-auto px-4 lg:px-6 py-16 lg:py-24">
            <div className="max-w-2xl mx-auto text-center mb-10">
              <h2 className="font-display font-semibold text-2xl lg:text-[32px] text-[var(--color-ink)]">
                Have questions first?
              </h2>
              <p className="text-[var(--color-ink-soft)] mt-3 text-base">
                Send us a message and we'll get back to you.
              </p>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>
      <LandingFooter />
      <ToastViewport />
    </div>
  );
}
