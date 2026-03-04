const { Client } = require('@line/bot-sdk');
const axios = require('axios');
const fs    = require('fs');
const path  = require('path');
const { PrismaClient } = require('@prisma/client');
const { buildInvoiceFlexMessage } = require('../utils/flexMessage');

const prisma = new PrismaClient();

/**
 * Build a LINE client using tokens from DB (fallback to env vars).
 */
async function getLineClient() {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['lineChannelAccessToken', 'lineChannelSecret'] } },
  });
  const map    = Object.fromEntries(rows.map(s => [s.key, s.value]));
  const token  = map.lineChannelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const secret = map.lineChannelSecret      || process.env.LINE_CHANNEL_SECRET;
  return new Client({ channelAccessToken: token, channelSecret: secret });
}

/**
 * Push an invoice Flex Message to a LINE user.
 */
async function pushInvoiceMessage(lineUserId, invoice) {
  const client = await getLineClient();
  const row    = await prisma.setting.findUnique({ where: { key: 'dormName' } });
  const dormName = row?.value || 'หอพัก';
  const message  = buildInvoiceFlexMessage(invoice, dormName);
  return client.pushMessage(lineUserId, message);
}

/**
 * Download an image from LINE's content API and save to uploads/slips/.
 * Returns the local file path.
 */
async function downloadLineImage(messageId) {
  const client = await getLineClient();
  const stream = await client.getMessageContent(messageId);
  const dir    = path.join(process.cwd(), 'uploads', 'slips');
  fs.mkdirSync(dir, { recursive: true });
  const filename = `slip_${messageId}_${Date.now()}.jpg`;
  const filePath = path.join(dir, filename);

  return new Promise((resolve, reject) => {
    const dest = fs.createWriteStream(filePath);
    stream.pipe(dest);
    dest.on('finish', () => resolve(`uploads/slips/${filename}`));
    dest.on('error', reject);
  });
}

/**
 * Reply with a text message.
 */
async function replyText(replyToken, text) {
  const client = await getLineClient();
  return client.replyMessage(replyToken, { type: 'text', text });
}

module.exports = { getLineClient, pushInvoiceMessage, downloadLineImage, replyText };
