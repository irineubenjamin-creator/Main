require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PUSHCUT_URL = process.env.PUSHCUT_URL || 'https://api.pushcut.io/XXYjqttEikZXDA0S7hy1W/notifications/Nova%20venda%20realizada';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'CartPanda Webhook ativo' });
});

// Endpoint de postback para a CartPanda
app.post('/webhook/cartpanda', async (req, res) => {
  const payload = req.body;

  // Validação de segredo (opcional - configure WEBHOOK_SECRET no .env)
  if (WEBHOOK_SECRET) {
    const receivedSecret = req.headers['x-webhook-secret'] || req.query.secret;
    if (receivedSecret !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  // Aceita apenas eventos Order.paid
  const event = payload.event || payload.type || payload.trigger;
  if (event && event !== 'Order.paid' && event !== 'order.paid') {
    return res.status(200).json({ message: 'Evento ignorado', event });
  }

  // Extrai dados do pedido
  const order = payload.order || payload.data || payload;
  const orderId = order.id || order.order_id || order.number || 'N/A';
  const customerName = order.customer?.name || order.billing?.name || order.name || 'Cliente';
  const total = order.total_price || order.total || order.amount || '0.00';
  const currency = order.currency || 'BRL';

  const totalFormatado = parseFloat(total).toLocaleString('pt-BR', {
    style: 'currency',
    currency: currency === 'BRL' ? 'BRL' : 'BRL',
  });

  console.log(`[Order.paid] Pedido #${orderId} - ${customerName} - ${totalFormatado}`);

  // Envia notificação via Pushcut
  try {
    await axios.post(PUSHCUT_URL, {
      title: '🛒 Nova venda realizada!',
      text: `Pedido #${orderId}\nCliente: ${customerName}\nValor: ${totalFormatado}`,
    });
    console.log('[Pushcut] Notificação enviada com sucesso');
  } catch (err) {
    console.error('[Pushcut] Erro ao enviar notificação:', err.message);
    // Retorna 200 mesmo assim para a CartPanda não retentar
  }

  res.status(200).json({ received: true, orderId });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Postback URL: http://SEU_DOMINIO/webhook/cartpanda`);
});
