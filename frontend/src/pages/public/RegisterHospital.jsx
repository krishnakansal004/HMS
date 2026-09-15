import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Stethoscope, Building2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { plansApi, tenantsApi } from '../../api/plans.js';
import { Input, Select } from '../../components/ui/Input.jsx';
import Button from '../../components/ui/Button.jsx';
import Card, { CardBody } from '../../components/ui/Card.jsx';
import { Spinner } from '../../components/ui/Table.jsx';
import { toast } from '../../components/ui/Toast.jsx';
import { loadRazorpay } from '../../utils/loadRazorpay.js';

const initialForm = {
  name: '',
  slug: '',
  planId: '',
  adminName: '',
  adminEmail: '',
  adminPassword: ''
};

export default function RegisterHospital() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [successSlug, setSuccessSlug] = useState(null);

  useEffect(() => {
    plansApi.publicList()
      .then(res => setPlans(res.data || []))
      .catch(() => toast.error('Failed to load subscription plans.'))
      .finally(() => setLoadingPlans(false));
  }, []);

  function update(field) {
    return (e) => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  function handleNameChange(e) {
    const val = e.target.value;
    setForm(f => ({
      ...f,
      name: val,
      slug: val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    let waitingForPayment = false;
    try {
      const result = await tenantsApi.provision(form);
      const payment = result.data;
      if (!payment?.paymentRequired) {
        setSuccessSlug(form.slug);
        toast.success('Hospital tenant provisioned successfully!');
        return;
      }

      if (!(await loadRazorpay())) {
        throw new Error('Payment checkout could not be loaded. Please try again.');
      }
      waitingForPayment = true;
      const checkout = new window.Razorpay({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        name: 'HMS Clinical Ledger',
        description: `${payment.planName} hospital subscription`,
        order_id: payment.orderId,
        prefill: payment.prefill,
        theme: { color: '#0ea5e9' },
        handler: async (response) => {
          try {
            await tenantsApi.verifyProvisionPayment({
              signupId: payment.signupId,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            });
            setSuccessSlug(form.slug);
            toast.success('Payment verified. Hospital tenant provisioned successfully!');
          } catch (err) {
            toast.error(err.message || 'Payment was received but could not be verified yet.');
          } finally {
            setSaving(false);
          }
        },
        modal: { ondismiss: () => { waitingForPayment = false; setSaving(false); } },
      });
      checkout.on('payment.failed', () => {
        waitingForPayment = false;
        setSaving(false);
        toast.error('Payment failed. Your hospital was not provisioned.');
      });
      checkout.open();
    } catch (err) {
      if (err.fieldErrors?.length) {
        const fe = {};
        err.fieldErrors.forEach((f) => (fe[f.field] = f.message));
        setErrors(fe);
      } else {
        toast.error(err.message || 'Failed to provision hospital.');
      }
    } finally {
      if (!waitingForPayment) setSaving(false);
    }
  }

  if (successSlug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper)] px-4">
        <div className="max-w-md w-full bg-white border border-[var(--color-border)] rounded-[var(--radius-lg)] p-8 text-center flex flex-col items-center gap-4 shadow-sm">
          <div className="h-12 w-12 rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)] flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">Hospital Provisioned Successfully</h2>
          <p className="text-sm text-[var(--color-ink-soft)]">
            Your hospital workspace is ready. You can now sign in using your admin credentials and hospital ID: <strong className="font-mono-data text-[var(--color-ink)]">{successSlug}</strong>
          </p>
          <Button onClick={() => navigate('/login')} className="w-full mt-2">
            Sign In to Workspace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-paper)] py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="max-w-2xl mx-auto w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-4 group">
            <div className="h-10 w-10 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white flex items-center justify-center">
              <Stethoscope size={22} />
            </div>
            <span className="font-display font-semibold text-xl text-[var(--color-ink)]">HMS Clinical Ledger</span>
          </Link>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">Register Your Hospital</h1>
          <p className="text-sm text-[var(--color-ink-soft)] mt-1">Provision a secure multi-tenant hospital workspace and administrative account.</p>
        </div>

        <Card className="bg-white shadow-sm border-[var(--color-border)]">
          <CardBody className="p-8">
            {loadingPlans ? (
              <Spinner label="Loading subscription plans..." />
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                
                {/* Hospital Details */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-sm font-semibold text-[var(--color-ink)] uppercase tracking-wider flex items-center gap-2 border-b border-[var(--color-border)] pb-2">
                    <Building2 size={16} className="text-[var(--color-primary)]" /> Hospital Facility Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Hospital Name" required value={form.name} onChange={handleNameChange} error={errors.name} placeholder="e.g. Sunrise General Hospital" />
                    <Input label="Portal URL Slug" required value={form.slug} onChange={update('slug')} error={errors.slug} hint="Auto-generated URL identifier" />
                  </div>
                  <Select label="Subscription Tier & Plan" required value={form.planId} onChange={update('planId')} error={errors.planId}>
                    <option value="">Select a subscription plan...</option>
                    {plans.map(p => (
                      <option key={p.plan_id} value={p.plan_id}>
                        {p.name} ({p.prices?.monthly ? `₹${p.prices.monthly}/mo` : 'Free'})
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Admin Credentials */}
                <div className="flex flex-col gap-4 pt-4">
                  <h3 className="text-sm font-semibold text-[var(--color-ink)] uppercase tracking-wider flex items-center gap-2 border-b border-[var(--color-border)] pb-2">
                    <ShieldCheck size={16} className="text-[var(--color-primary)]" /> Primary Administrator Account
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Administrator Full Name" required value={form.adminName} onChange={update('adminName')} error={errors.adminName} placeholder="e.g. Dr. Rajesh Sharma" />
                    <Input label="Work Email Address" type="email" required value={form.adminEmail} onChange={update('adminEmail')} error={errors.adminEmail} placeholder="admin@hospital.com" />
                  </div>
                  <Input 
                    label="Temporary Password" 
                    type="password" 
                    required 
                    value={form.adminPassword} 
                    onChange={update('adminPassword')} 
                    error={errors.adminPassword} 
                    hint="At least 8 characters, containing an uppercase letter, lowercase letter, and number." 
                  />
                </div>

                <div className="pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                  <Link to="/" className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                    &larr; Back to Home
                  </Link>
                  <Button type="submit" loading={saving} size="lg">
                    Provision Hospital Workspace
                  </Button>
                </div>

              </form>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
