// Thin wrapper around the Razorpay Checkout SDK (loaded via <script> in
// index.html). Keeps the imperative, non-React SDK shape out of components.

/**
 * @param {{orderId:string, amount:number, currency:string, keyId:string}} order
 * @param {{name:string, description?:string, prefill?:object,
 *   onSuccess:(response:{razorpay_payment_id:string, razorpay_order_id:string, razorpay_signature:string})=>void,
 *   onDismiss?:()=>void, onError?:(err:Error|{description?:string})=>void}} handlers
 */
export function openRazorpayCheckout(order, { name, description, prefill, onSuccess, onDismiss, onError }) {
  if (!window.Razorpay) {
    onError?.(new Error('Razorpay checkout script failed to load. Check your connection and try again.'));
    return;
  }

  const rzp = new window.Razorpay({
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    order_id: order.orderId,
    name,
    description,
    prefill,
    theme: { color: '#0f766e' },
    handler: (response) => onSuccess(response),
    modal: { ondismiss: () => onDismiss?.() },
  });

  rzp.on('payment.failed', (resp) => onError?.(resp.error));
  rzp.open();
}
