import { useState } from "react";
import { Plus, Receipt, CreditCard } from "lucide-react";
import { useAsync } from "../../hooks/useAsync.js";
import { invoicesApi, INVOICE_STATUSES } from "../../api/invoices.js";
import { paymentsApi } from "../../api/payments.js";
import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import { Select } from "../../components/ui/Input.jsx";
import StatusPill from "../../components/ui/StatusPill.jsx";
import {
  Table,
  Thead,
  Th,
  Tr,
  Td,
  Spinner,
  EmptyState,
  ErrorState,
} from "../../components/ui/Table.jsx";
import { formatPaise, formatDate, fullName } from "../../utils/format.js";
import { useAuthStore } from "../../store/authStore.js";
import { ROLES } from "../../utils/roles.js";
import { loadRazorpay } from "../../utils/loadRazorpay.js";
import { toast } from "../../components/ui/Toast.jsx";
import { useNavigate } from "react-router-dom";
import GenerateInvoiceForm from "./GenerateInvoiceForm.jsx";
import RecordPaymentModal from "./RecordPaymentModal.jsx";

export default function InvoicesList() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isPatient = user?.role === ROLES.PATIENT;
  const canGenerate = [
    "HOSPITAL_ADMIN",
    "RECEPTIONIST",
    "ACCOUNTANT",
    "DOCTOR",
  ].includes(user?.role);
  const canRecordPayment = ["HOSPITAL_ADMIN", "ACCOUNTANT", "CASHIER"].includes(
    user?.role,
  );
  const [statusFilter, setStatusFilter] = useState("");

  const [payingInvoice, setPayingInvoice] = useState(null);
  const [onlinePayingId, setOnlinePayingId] = useState(null);

  const { data, loading, error, refetch } = useAsync(
    () => invoicesApi.list({ status: statusFilter || undefined, limit: 50 }),
    [statusFilter],
  );

  const invoices = data?.data || data?.invoices || [];

  async function handleOnlinePayment(invoiceId) {
    setOnlinePayingId(invoiceId);
    try {
      const isLoaded = await loadRazorpay();
      if (!isLoaded)
        throw new Error(
          "Failed to load payment gateway. Check your connection.",
        );

      const { data } = await paymentsApi.initiate({ invoiceId });
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: user.tenantName || "Hospital Billing",
        description: "Online Medical Bill Payment",
        order_id: data.orderId,
        prefill: {
          name: data.patient.name,
          email: data.patient.email,
          contact: data.patient.contact,
        },
        theme: { color: "#0ea5e9" },
        handler: async function (response) {
          setOnlinePayingId(invoiceId);
          try {
            await paymentsApi.verifyWebhook({
              invoiceId: invoiceId,
              gatewayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
              amountPaid: data.amount / 100,
            });
            toast.success("Payment verified! Processing receipt...");
            refetch();
          } catch (verifyErr) {
            toast.error(
              verifyErr.message ||
                "Payment succeeded but verification failed. Contact support.",
            );
          } finally {
            setOnlinePayingId(null);
          }
        },
        modal: {
          ondismiss: function () {
            setOnlinePayingId(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (res) =>
        toast.error(`Payment Failed: ${res.error.description}`),
      );
      rzp.open();
    } catch (err) {
      toast.error(err.message || "Unable to initiate payment.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
            Billing & Invoices
          </h2>
          <p className="text-sm text-[var(--color-ink-soft)] mt-0.5">
            Manage patient billing and payment collection
          </p>
        </div>
        {canGenerate && (
          <Button icon={Plus} onClick={() => navigate("/invoices/new")}>
            Generate Invoice
          </Button>
        )}
      </div>

      <Card>
        <div className="p-4 border-b border-[var(--color-border)] flex items-center gap-3">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="max-w-[200px]"
          >
            <option value="">All Statuses</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <Spinner label="Loading financial ledger..." />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No invoices found"
            description={
              statusFilter
                ? "Try clearing your status filter."
                : "Generate your first bill to start collecting revenue."
            }
            action={
              !statusFilter &&
              canGenerate && (
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={() => navigate("/invoices/new")}
                >
                  Generate Invoice
                </Button>
              )
            }
          />
        ) : (
          <Table>
            <Thead>
              <Th>Invoice #</Th>
              {!isPatient && <Th>Patient</Th>}
              <Th>Created On</Th>
              <Th>Amount</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Thead>
            <tbody>
              {invoices.map((inv) => (
                <Tr key={inv.invoice_id}>
                  <Td className="font-mono-data font-medium">
                    #{inv.invoice_number}
                  </Td>
                  {!isPatient && <Td>{fullName(inv.patient) || "Unknown"}</Td>}
                  <Td>{formatDate(inv.created_at)}</Td>
                  <Td>
                    <div className="flex flex-col">
                      <span className="font-mono-data font-semibold text-[var(--color-ink)]">
                        {formatPaise(inv.total)}
                      </span>
                      {Number(inv.amount_paid) > 0 &&
                        Number(inv.amount_paid) < Number(inv.total) && (
                          <span className="text-[10px] text-[var(--color-ink-faint)]">
                            Paid: {formatPaise(inv.amount_paid)}
                          </span>
                        )}
                    </div>
                  </Td>
                  <Td>
                    <StatusPill status={inv.status} />
                  </Td>
                  <Td className="text-right">
                    {(inv.status === "pending" ||
                      inv.status === "partial" ||
                      inv.status === "draft") &&
                      (isPatient ? (
                        <Button
                          size="sm"
                          variant="primary"
                          icon={CreditCard}
                          onClick={() => handleOnlinePayment(inv.invoice_id)}
                          loading={onlinePayingId === inv.invoice_id}
                          disabled={
                            onlinePayingId !== null &&
                            onlinePayingId !== inv.invoice_id
                          }
                        >
                          Pay Online
                        </Button>
                      ) : canRecordPayment ? (
                        <Button
                          size="sm"
                          variant="primary"
                          icon={CreditCard}
                          onClick={() => setPayingInvoice(inv)}
                        >
                          Record Payment
                        </Button>
                      ) : null)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {payingInvoice && (
        <RecordPaymentModal
          open={!!payingInvoice}
          onClose={() => setPayingInvoice(null)}
          invoice={payingInvoice}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
