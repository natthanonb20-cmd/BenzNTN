const { Client } = require('@line/bot-sdk');
const axios = require('axios');
const fs    = require('fs');
const path  = require('path');
const { PrismaClient } = require('@prisma/client');
const { buildInvoiceFlexMessage } = require('../utils/flexMessage');

const prisma = new PrismaClient();

/**
 * Build a LINE client using tokens from PropertySetting for a specific property.
 * @param {string} propertyId
 */
async function getLineClient(propertyId) {
  const rows = await prisma.propertySetting.findMany({
    where: {
      propertyId,
      key: { in: ['lineChannelAccessToken', 'lineChannelSecret'] },
    },
  });
  const map    = Object.fromEntries(rows.map(s => [s.key, s.value]));
  const token  = map.lineChannelAccessToken || process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const secret = map.lineChannelSecret      || process.env.LINE_CHANNEL_SECRET;

  if (!token) throw new Error(`LINE token not configured for property ${propertyId}`);
  return new Client({ channelAccessToken: token, channelSecret: secret });
}

/**
 * Push an invoice Flex Message to a LINE user.
 */
async function pushInvoiceMessage(lineUserId, invoice, propertyId) {
  const client = await getLineClient(propertyId);

  // โหลด settings ที่เกี่ยวกับ card design
  const rows = await prisma.propertySetting.findMany({
    where: {
      propertyId,
      key: { in: ['dormName', 'cardStyle', 'cardHeaderColor', 'cardAccentColor'] },
    },
  });
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));

  const dormName = s.dormName || 'หอพัก';
  const theme    = {
    style:       s.cardStyle       || 'classic',
    headerColor: s.cardHeaderColor || '#1e40af',
    accentColor: s.cardAccentColor || '#1e40af',
  };

  const message = buildInvoiceFlexMessage(invoice, dormName, theme);
  return client.pushMessage(lineUserId, message);
}

/**
 * Download an image from LINE's content API and save to uploads/slips/.
 * Returns the local file path.
 */
async function downloadLineImage(messageId, propertyId) {
  const client = await getLineClient(propertyId);
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
async function replyText(replyToken, text, propertyId) {
  const client = await getLineClient(propertyId);
  return client.replyMessage(replyToken, { type: 'text', text });
}

module.exports = { getLineClient, pushInvoiceMessage, downloadLineImage, replyText };
