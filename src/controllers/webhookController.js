const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { downloadLineImage, replyText } = require('../services/lineService');

/**
 * Verify Line signature (HMAC-SHA256 of raw body with channel secret).
 * Reads secret from DB first, falls back to env var.
 */
async function verifySignature(rawBody, signature) {
  const row    = await prisma.setting.findUnique({ where: { key: 'lineChannelSecret' } });
  const secret = row?.value || process.env.LINE_CHANNEL_SECRET;
  const hash   = crypto.createHmac('SHA256', secret).update(rawBody).digest('base64');
  return hash === signature;
}

exports.handleLine = async (req, res) => {
  console.log('[LINE] request received');
  // Line sends raw body so we can verify signature
  const rawBody   = req.body; // Buffer because we use express.raw() in app.js
  const signature = req.headers['x-line-signature'];
  console.log('[LINE] signature:', signature);
  console.log('[LINE] body length:', rawBody?.length);

  const sigOk = await verifySignature(rawBody, signature);
  console.log('[LINE] signature valid:', sigOk);
  if (!sigOk) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Bad JSON' });
  }

  // Respond to Line immediately (must be within 5s)
  res.status(200).end();

  // Process events asynchronously
  for (const event of body.events ?? []) {
    try {
      await processEvent(event);
    } catch (err) {
      console.error('Webhook event error:', err);
    }
  }
};

async function processEvent(event) {
  const { type, source, replyToken } = event;
  const lineUserId = source?.userId;
  if (!lineUserId) return;

  // ---- Image message = potential slip ----
  if (type === 'message' && event.message?.type === 'image') {
    await handleSlip(event, lineUserId);
    return;
  }

  // ---- Text message: simple auto-reply ----
  if (type === 'message' && event.message?.type === 'text') {
    const text = event.message.text.trim();

    if (text === 'บิล' || text === 'ยอด') {
      await handleInvoiceQuery(lineUserId, replyToken);
      return;
    }

    // ---- ลงทะเบียน: ผู้เช่าพิมพ์เลขห้อง เช่น "101" หรือ "ห้อง 101" ----
    const roomMatch = text.match(/^(?:ห้อง\s*)?(\d+(?:\/\d+)?)$/);
    if (roomMatch) {
      await handleRegister(lineUserId, replyToken, roomMatch[1]);
      return;
    }

    // ---- ข้อความทั่วไป: แนะนำวิธีใช้ ----
    await replyText(replyToken,
      'สวัสดีครับ 👋\n' +
      'พิมพ์ตัวเลขห้องของท่านเพื่อลงทะเบียน เช่น "101"\n' +
      'หรือพิมพ์ "บิล" เพื่อดูยอดค้างชำระ'
    );
  }
}

async function handleRegister(lineUserId, replyToken, roomNumber) {
  // หาห้องที่มีผู้เช่าอยู่ปัจจุบัน
  const contract = await prisma.contract.findFirst({
    where: {
      isActive: true,
      room: { roomNumber },
    },
    include: { tenant: true, room: true },
  });

  if (!contract) {
    await replyText(replyToken, `❌ ไม่พบห้อง ${roomNumber} หรือห้องไม่มีผู้เช่าอยู่\nกรุณาติดต่อแอดมิน`);
    return;
  }

  // บันทึก lineUserId ลง tenant
  await prisma.tenant.update({
    where: { id: contract.tenantId },
    data:  { lineUserId },
  });

  await replyText(
    replyToken,
    `✅ ลงทะเบียนสำเร็จ!\n` +
    `ห้อง: ${roomNumber}\n` +
    `ชื่อ: ${contract.tenant.name}\n\n` +
    `พิมพ์ "บิล" เพื่อดูยอดค้างชำระได้เลยครับ 🙏`
  );
}

async function handleSlip(event, lineUserId) {
  const { replyToken, message } = event;

  // Find the active contract for this tenant
  const tenant = await prisma.tenant.findFirst({
    where: { lineUserId },
    include: {
      contracts: {
        where: { isActive: true },
        include: {
          invoices: {
            where: { status: 'PENDING' },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            take: 1,
          },
        },
        take: 1,
      },
    },
  });

  if (!tenant) {
    await replyText(replyToken, 'ไม่พบข้อมูลผู้เช่าของท่านในระบบ กรุณาติดต่อแอดมิน');
    return;
  }

  const latestInvoice = tenant.contracts[0]?.invoices[0];
  if (!latestInvoice) {
    await replyText(replyToken, 'ไม่พบใบแจ้งหนี้ที่รอชำระ ขอบคุณครับ/ค่ะ');
    return;
  }

  // Download slip image
  const slipPath = await downloadLineImage(message.id);

  // Update invoice status → REVIEW
  await prisma.invoice.update({
    where: { id: latestInvoice.id },
    data:  { status: 'REVIEW', slipPath },
  });

  await replyText(
    replyToken,
    '✅ ได้รับสลิปเรียบร้อยแล้ว\nแอดมินจะตรวจสอบและยืนยันการชำระภายใน 24 ชั่วโมง\nขอบคุณครับ/ค่ะ 🙏'
  );
}

async function handleInvoiceQuery(lineUserId, replyToken) {
  const tenant = await prisma.tenant.findFirst({
    where: { lineUserId },
    include: {
      contracts: {
        where: { isActive: true },
        include: {
          room: true,
          invoices: {
            where: { status: { in: ['PENDING', 'REVIEW'] } },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            take: 1,
          },
        },
        take: 1,
      },
    },
  });

  const invoice = tenant?.contracts[0]?.invoices[0];
  if (!invoice) {
    await replyText(replyToken, '✅ ไม่มียอดค้างชำระในขณะนี้ ขอบคุณครับ/ค่ะ');
    return;
  }

  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const room   = tenant.contracts[0].room;
  const status = invoice.status === 'REVIEW' ? '⏳ รอตรวจสอบสลิป' : '🔴 รอชำระเงิน';

  await replyText(
    replyToken,
    `📋 ยอดค้างชำระห้อง ${room.roomNumber}\n` +
    `เดือน: ${monthNames[invoice.month - 1]} ${invoice.year + 543}\n` +
    `ยอดรวม: ฿${Number(invoice.totalAmount).toLocaleString('th-TH')}\n` +
    `สถานะ: ${status}\n\n` +
    `กรุณาส่งรูปสลิปในแชทนี้เพื่อยืนยันการชำระ`
  );
}
