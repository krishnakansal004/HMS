import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarClock,
  Receipt,
  History,
  CreditCard,
  Video,
  CheckCircle2,
  Clock,
  Mic,
} from "lucide-react";
import { useAsync } from "../../hooks/useAsync.js";
import { appointmentsApi } from "../../api/appointments.js";
import { invoicesApi } from "../../api/invoices.js";
import { paymentsApi } from "../../api/payments.js";
import { prescriptionsApi } from "../../api/prescriptions.js";
import { labApi } from "../../api/lab.js";
import { radiologyApi } from "../../api/radiology.js";
import Card, { CardHeader, CardBody } from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import StatusPill from "../../components/ui/StatusPill.jsx";
import { Spinner, ErrorState, EmptyState } from "../../components/ui/Table.jsx";
import { formatPaise, formatDate } from "../../utils/format.js";
import { loadRazorpay } from "../../utils/loadRazorpay.js";
import { toast } from "../../components/ui/Toast.jsx";
import { TimelineIcon } from "./shared.jsx";

export default function PatientDashboard({ user }) {
  const navigate = useNavigate();
  const displayName =
    user?.name?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.email ||
    "Patient";

  const { data: apptsData, loading: apptsLoading } = useAsync(
    () => appointmentsApi.list({ limit: 10 }),
    [],
    "pat_appts",
  );
  const {
    data: invoicesData,
    loading: invLoading,
    error: invError,
    refetch: refetchInvs,
  } = useAsync(() => invoicesApi.list({ limit: 10 }), [], "pat_invs");

  const {
    data: timelineData,
    loading: timelineLoading,
    error: timelineError,
  } = useAsync(
    async () => {
      const results = await Promise.allSettled([
        prescriptionsApi.list({ limit: 10 }),
        labApi.listOrders({ limit: 10 }),
        radiologyApi.listOrders({ limit: 10 }),
      ]);
      const safeData = (res) =>
        res.status === "fulfilled" && res.value ? res.value.data : [];
      return {
        prescriptions: safeData(results[0]),
        labs: safeData(results[1]),
        radiologies: safeData(results[2]),
      };
    },
    [],
    "pat_timeline",
  );

  const appts = apptsData?.data || [];
  const allInvoices = invoicesData?.data || invoicesData?.invoices || [];
  const pendingInvoices = allInvoices.filter((inv) =>
    ["pending", "partial", "draft"].includes(inv.status),
  );
  const paidInvoices = allInvoices.filter((inv) => inv.status === "paid");
  // const pendingInvoices = invoicesData?.data || invoicesData?.invoices || [];
  const upcomingAppt = appts.find(
    (a) =>
      ["scheduled", "confirmed"].includes(a.status) &&
      new Date(a.slot_start) >= new Date(),
  );

  const [payingId, setPayingId] = useState(null);

  async function handleOnlinePayment(invoiceId) {
    setPayingId(invoiceId);
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
          setPayingId(invoiceId);
          try {
            await paymentsApi.verifyWebhook({
              invoiceId: invoiceId,
              gatewayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
              amountPaid: data.amount / 100,
            });
            toast.success("Payment verified! Processing receipt...");
            refetchInvs();
          } catch (verifyErr) {
            toast.error(
              verifyErr.message ||
                "Payment succeeded but verification failed. Contact support.",
            );
          } finally {
            setPayingId(null);
          }
        },
        modal: {
          ondismiss: function () {
            setPayingId(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (res) => {
        toast.error(`Payment Failed: ${res.error.description}`);
        setPayingId(null);
      });
      rzp.open();
    } catch (err) {
      toast.error(err.message || "Unable to initiate payment.");
      setPayingId(null);
    }
  }

  const timeline = useMemo(() => {
    if (!timelineData) return [];
    const items = [];
    timelineData.prescriptions.forEach((p) =>
      items.push({
        id: `rx-${p.prescription_id}`,
        type: "Prescription",
        date: p.created_at,
        title: "Prescription Issued",
        subtitle: `Dr. ${p.doctor_profile?.users?.name || "Unknown"}`,
        status: p.approval_status,
      }),
    );
    timelineData.labs.forEach((l) =>
      items.push({
        id: `lab-${l.lab_order_id}`,
        type: "Lab",
        date: l.created_at,
        title: l.test_name_snapshot,
        subtitle: `Code: ${l.test_code_snapshot}`,
        status: l.sample_status,
      }),
    );
    timelineData.radiologies.forEach((r) =>
      items.push({
        id: `rad-${r.radiology_order_id}`,
        type: "Radiology",
        date: r.created_at,
        title: r.study_type,
        subtitle: r.modality,
        status: r.status,
      }),
    );
    return items.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [timelineData]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-[var(--color-ink)]">
          Welcome, {displayName.split(" ")[0]}
        </h2>
        <p className="text-sm text-[var(--color-ink-soft)] mt-1">
          Your secure health portal at {user.tenantName || "the hospital"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-l-4 border-l-[var(--color-primary)]">
          <CardBody>
            <h3 className="text-xs font-bold text-[var(--color-ink-soft)] uppercase tracking-wider mb-4 flex items-center gap-2">
              <CalendarClock size={16} /> Next Appointment
            </h3>
            {apptsLoading ? (
              <Spinner size={16} label="Checking..." />
            ) : upcomingAppt ? (
              <div>
                <p className="font-display text-xl font-bold text-[var(--color-ink)]">
                  {formatDate(upcomingAppt.slot_start)}
                </p>
                <p className="text-sm font-medium text-[var(--color-ink-soft)] mt-1">
                  {new Date(upcomingAppt.slot_start).toLocaleTimeString(
                    "en-IN",
                    { hour: "2-digit", minute: "2-digit" },
                  )}
                </p>
                <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-ink)]">
                      Dr. {upcomingAppt.doctor_name_snapshot}
                    </p>
                    <p className="text-xs text-[var(--color-ink-faint)] capitalize">
                      {upcomingAppt.type.replace("_", " ")} Consultation
                    </p>
                  </div>
                  {upcomingAppt.type === "online" && (
                    <Button
                      size="sm"
                      icon={Video}
                      onClick={() =>
                        alert(
                          "Telemedicine integration pending Phase C provider selection.",
                        )
                      }
                    >
                      Join Call
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <EmptyState
                title="No upcoming appointments"
                description="Need to see a doctor? Book a visit."
                action={
                  <Button size="sm" onClick={() => navigate("/appointments")}>
                    Book Appointment
                  </Button>
                }
              />
            )}
            <div className="mt-5 p-4 border border-dashed border-[var(--color-border-strong)] rounded-[var(--radius-md)] bg-[var(--color-paper)]">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
                  <Mic size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    Voice Symptoms Upload
                  </p>
                  <p className="text-xs text-[var(--color-ink-soft)] mt-1">
                    Record your symptoms before your visit to help doctors
                    prepare.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    disabled
                  >
                    Record Audio (Coming Soon)
                  </Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card
          className={
            pendingInvoices.length > 0
              ? "border-l-4 border-l-[var(--color-danger)]"
              : "border-l-4 border-l-[var(--color-success)]"
          }
        >
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-[var(--color-ink-soft)] uppercase tracking-wider flex items-center gap-2">
                <Receipt size={16} /> Recent Bills
              </h3>
            </div>

            {invLoading ? (
              <Spinner size={16} label="Checking bills..." />
            ) : invError ? (
              <ErrorState message="Could not load bills" />
            ) : allInvoices.length > 0 ? (
              <div className="flex flex-col gap-3">
                {/* Render Pending Invoices */}
                {pendingInvoices.slice(0, 3).map((inv) => {
                  const remaining = Number(inv.total) - Number(inv.amount_paid);
                  return (
                    <div
                      key={inv.invoice_id}
                      className="flex items-center justify-between p-3 bg-[var(--color-danger-soft)]/30 border border-[var(--color-danger)]/20 rounded-[var(--radius-sm)]"
                    >
                      <div>
                        <p className="font-mono-data font-bold text-[var(--color-ink)]">
                          {formatPaise(remaining)}
                        </p>
                        <p className="text-xs text-[var(--color-ink-soft)]">
                          Invoice #{inv.invoice_number}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={CreditCard}
                        onClick={() => handleOnlinePayment(inv.invoice_id)}
                        loading={payingId === inv.invoice_id}
                        disabled={
                          payingId !== null && payingId !== inv.invoice_id
                        }
                      >
                        Pay Now
                      </Button>
                    </div>
                  );
                })}

                {/* Render Paid Invoices */}
                {paidInvoices.slice(0, 3).map((inv) => (
                  <div
                    key={inv.invoice_id}
                    className="flex items-center justify-between p-3 bg-[var(--color-success-soft)]/30 border border-[var(--color-success)]/20 rounded-[var(--radius-sm)] opacity-80"
                  >
                    <div>
                      <p className="font-mono-data font-bold text-[var(--color-ink)]">
                        {formatPaise(inv.total)}
                      </p>
                      <p className="text-xs text-[var(--color-ink-soft)]">
                        Invoice #{inv.invoice_number}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[var(--color-success)] text-xs font-bold uppercase tracking-wider">
                      <CheckCircle2 size={16} /> Paid
                    </div>
                  </div>
                ))}

                {allInvoices.length > 3 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/invoices")}
                  >
                    View all {allInvoices.length} bills
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-[var(--color-success)]">
                <div className="h-10 w-10 bg-[var(--color-success-soft)] rounded-full flex items-center justify-center mb-2">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-sm font-medium">All caught up!</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="flex-1 min-h-[400px]">
        <CardHeader
          title="My Medical Records"
          subtitle="Lab results, prescriptions, and radiology"
          action={<History size={18} className="text-[var(--color-primary)]" />}
        />
        <CardBody>
          {timelineLoading ? (
            <Spinner label="Loading health records..." />
          ) : timelineError ? (
            <ErrorState message="Could not load medical records" />
          ) : timeline.length === 0 ? (
            <EmptyState
              icon={History}
              title="No Records Found"
              description="Your clinical history will securely appear here."
            />
          ) : (
            <div className="relative border-l-2 border-[var(--color-border-strong)] ml-4 pl-8 py-2 flex flex-col gap-6">
              {timeline.map((item) => (
                <div key={item.id} className="relative">
                  <div className="absolute -left-[49px] top-0 bg-[var(--color-surface)] py-1">
                    <TimelineIcon type={item.type} />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[var(--color-paper)] p-3 rounded-[var(--radius-md)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/50 transition-colors cursor-pointer">
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--color-ink)]">
                        {item.title}
                      </h4>
                      <p className="text-xs text-[var(--color-ink-soft)] mt-0.5">
                        {item.subtitle}
                      </p>
                      <p className="text-[11px] text-[var(--color-ink-faint)] mt-1 font-mono-data flex items-center gap-1.5">
                        <Clock size={10} /> {formatDate(item.date)}
                      </p>
                    </div>
                    <StatusPill status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
