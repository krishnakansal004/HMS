import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import Button from '../../components/ui/Button.jsx';
import { paymentsApi } from '../../api/payments.js';
import { invoicesApi } from '../../api/invoices.js';
import { openRazorpayCheckout } from '../../utils/razorpay.js';
import { toast } from '../../components/ui/Toast.jsx';
import { fullName } from '../../utils/format.js';

// Records the payment against the invoice via the existing manual/offline
// pay endpoint once Razorpay's client-side handler reports success. This is
// a stand-in for real server-side confirmation — the webhook handler
// (backend/src/controllers/paymentController.js `handleWebhook`) is still
// an empty stub with no signature verification — so it trusts the browser
// callback rather than a verified webhook. Fine for local/test-mode use.
export default function PayButton({ invoice, balance, onPaid }) {
  const [loading, setLoading] = useState(false);

  async function handlePay() {
    setLoading(true);
    try {
      const res = await paymentsApi.initiate(invoice.invoice_id);
      const order = res.data;

      openRazorpayCheckout(order, {
        name: 'HMS Billing',
        description: `Invoice for ${fullName(invoice.patient)}`,
        onSuccess: async (response) => {
          try {
            await invoicesApi.pay(invoice.invoice_id, {
              amount: order.amount,
              method: 'CARD',
              transactionId: response.razorpay_payment_id,
            });
            toast.success('Payment recorded successfully');
            onPaid();
          } catch (err) {
            toast.error(err.message || 'Payment succeeded but recording it failed');
          } finally {
            setLoading(false);
          }
        },
        onDismiss: () => {
          toast.info('Payment cancelled');
          setLoading(false);
        },
        onError: (err) => {
          toast.error(err?.description || err?.message || 'Payment failed');
          setLoading(false);
        },
      });
    } catch (err) {
      toast.error(err.message || 'Could not start payment');
      setLoading(false);
    }
  }

  return (
    <Button size="sm" icon={CreditCard} loading={loading} onClick={handlePay}>
      Pay {balance}
    </Button>
  );
}
