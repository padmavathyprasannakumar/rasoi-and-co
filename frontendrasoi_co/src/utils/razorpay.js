import api from '../api/axios';

let scriptPromise = null;

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => resolve(true);
      s.onerror = () => {
        scriptPromise = null;
        resolve(false);
      };
      document.body.appendChild(s);
    });
  }
  return scriptPromise;
}

/**
 * Opens Razorpay Checkout (UPI / Cards / Net banking / Wallets) for an existing order.
 * Resolves with the verified order, or rejects with an Error.
 */
export async function payWithRazorpay(orderNumber) {
  const ok = await loadRazorpay();
  if (!ok) throw new Error('Could not load Razorpay. Check your internet connection and try again.');

  const { data } = await api.post('/payments/razorpay/create-order/', { order_number: orderNumber });

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: data.key_id || import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: data.amount,
      currency: 'INR',
      name: data.name,
      description: data.description,
      order_id: data.razorpay_order_id,
      prefill: data.prefill,
      theme: { color: data.theme_color || '#B87333' },
      notes: { order_number: orderNumber },
      handler: async (response) => {
        try {
          const verify = await api.post('/payments/razorpay/verify/', {
            order_number: orderNumber,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          resolve(verify.data);
        } catch (err) {
          reject(new Error(err.response?.data?.detail || 'Payment verification failed.'));
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled. Your order is saved — you can pay from My orders.')),
      },
    });
    rzp.on('payment.failed', async () => {
      try {
        await api.post('/payments/razorpay/failed/', { order_number: orderNumber });
      } catch {
        /* ignore */
      }
    });
    rzp.open();
  });
}
