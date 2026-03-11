require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PUSHCUT_URL = process.env.PUSHCUT_URL || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'CartPanda Webhook ativo' });
});

// Endpoint de postback para a CartPanda
app.post('/webhook/cartpanda', async (req, res) => {
  const payload = req.body;

  // Validação de segredo opcional
  if (WEBHOOK_SECRET) {
    const receivedSecret = req.headers['x-webhook-secret'] || req.query.secret;
    if (receivedSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const event = (payload.event || '').toLowerCase();

  // Aceita apenas order.paid e order.created
  if (event !== 'order.paid' && event !== 'order.created') {
    return res.status(200).json({ message: 'Evento ignorado', event });
  }

  const order = payload.order || {};

  // Número do pedido
  const orderNumber = order.number || order.order_number || order.id || 'N/A';

  // Nome do cliente
  const customer = order.customer || {};
  const customerName =
    customer.full_name ||
    `${customer.first_name || ''} ${customer.last_name || ''}`.trim() ||
    'Cliente';

  // Valor total — unformatted_total_price está em centavos
  const totalCentavos = order.unformatted_total_price || 0;
  const totalFormatado = (totalCentavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  // Forma de pagamento
  const paymentType = order.payment?.type || order.payment_type || '';
  const paymentLabel = {
    boleto: 'Boleto',
    pix: 'PIX',
    credit_card: 'Cartão de Crédito',
    creditcard: 'Cartão de Crédito',
  }[paymentType] || paymentType || 'N/A';

  // Produto(s)
  const lineItems = order.line_items || [];
  const produtos = lineItems.map(i => `${i.quantity}x ${i.name || i.title}`).join(', ') || 'N/A';

  // Label do evento
  const eventLabel = event === 'order.paid' ? '💰 Venda confirmada!' : '🛒 Novo pedido criado!';

  console.log(`[${event}] Pedido #${orderNumber} | ${customerName} | ${totalFormatado} | ${paymentLabel}`);

  // Envia notificação via Pushcut
  if (!PUSHCUT_URL) {
    console.warn('[Pushcut] PUSHCUT_URL não configurado no .env');
    return res.status(200).json({ received: true, orderNumber });
  }

  try {
    await axios.post(PUSHCUT_URL, {
      title: eventLabel,
      text: `Pedido #${orderNumber}\nCliente: ${customerName}\nValor: ${totalFormatado}\nPagamento: ${paymentLabel}\nProduto(s): ${produtos}`,
    });
    console.log('[Pushcut] Notificação enviada com sucesso');
  } catch (err) {
    console.error('[Pushcut] Erro ao enviar notificação:', err.message);
    // Retorna 200 assim mesmo para a CartPanda não retentar
  }

  res.status(200).json({ received: true, orderNumber });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Postback URL: http://SEU_DOMINIO/webhook/cartpanda`);
});
