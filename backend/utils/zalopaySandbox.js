const QRCode = require('qrcode');

function normalizeOrderId(orderId) {
  return String(orderId || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 24)
    .toUpperCase();
}

function buildSandboxPayload(order) {
  const amount = Math.round(Number(order.total || 0));
  const orderId = normalizeOrderId(order.order_id);
  const transactionId = `ZLP-${orderId}-${Date.now().toString().slice(-6)}`;
  const description = `Thanh toan don ${order.order_id}`;

  const qrText = [
    'zalopay-sandbox://pay',
    `?app_id=${encodeURIComponent(process.env.ZALOPAY_APP_ID || 'sandbox-app')}`,
    `&app_trans_id=${encodeURIComponent(transactionId)}`,
    `&amount=${encodeURIComponent(amount)}`,
    `&description=${encodeURIComponent(description)}`,
    `&order_id=${encodeURIComponent(order.order_id)}`,
  ].join('');

  return {
    appId: process.env.ZALOPAY_APP_ID || 'sandbox-app',
    amount,
    orderId: order.order_id,
    transactionId,
    description,
    qrText,
    paymentUrl: `https://sandbox.zalopay.vn/qr?app_trans_id=${encodeURIComponent(transactionId)}&amount=${encodeURIComponent(amount)}&description=${encodeURIComponent(description)}`,
  };
}

async function createSandboxQrPayload(order) {
  const payload = buildSandboxPayload(order);
  const qrDataUrl = await QRCode.toDataURL(payload.qrText, {
    margin: 1,
    width: 220,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  return {
    ...payload,
    qrDataUrl,
    gateway: 'sandbox',
    note: 'Mã QR này dùng cho thử nghiệm ZaloPay Sandbox trong môi trường phát triển.',
  };
}

module.exports = {
  createSandboxQrPayload,
};
