import { apiRequest } from './api';

interface RazorpayHandlerResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, cb: (resp: { error?: { description?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

export interface RazorpayOrderPayload {
  orderId: string;
  amountPaise: number;
  amountInr: number;
  currency: string;
  keyId: string;
  bookingId: string;
  serviceTitle: string;
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export async function startRazorpayCheckout({
  bookingId,
  onSuccess,
  onError,
  onDismiss
}: {
  bookingId: string;
  onSuccess: (paymentId: string) => void;
  onError: (message: string) => void;
  onDismiss?: () => void;
}) {
  try {
    if (typeof window === 'undefined' || !window.Razorpay) {
      throw new Error('Razorpay checkout script is unavailable right now.');
    }

    const order = await apiRequest<RazorpayOrderPayload>('/payments/razorpay/order', {
      method: 'POST',
      body: JSON.stringify({ bookingId })
    });

    const rz = new window.Razorpay({
      key: order.keyId,
      amount: order.amountPaise,
      currency: order.currency || 'INR',
      name: 'Kajer Manus',
      description: order.serviceTitle || 'Service Booking Payment',
      order_id: order.orderId,
      prefill: order.prefill || {},
      theme: { color: '#166534' },
      handler: async (resp: RazorpayHandlerResponse) => {
        try {
          await apiRequest('/payments/razorpay/verify', {
            method: 'POST',
            body: JSON.stringify({
              bookingId,
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature
            })
          });
          onSuccess(resp.razorpay_payment_id);
        } catch (err) {
          onError((err as Error).message);
        }
      },
      modal: {
        ondismiss: () => {
          onDismiss?.();
        }
      }
    });

    rz.on('payment.failed', (resp) => {
      onError(resp?.error?.description || 'Payment failed');
    });

    rz.open();
  } catch (err) {
    onError((err as Error).message);
  }
}
