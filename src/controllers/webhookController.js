const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { downloadLineImage, replyText } = require('../services/lineService');

/**
 * Verify LINE signature using the property's own Channel Secret.
 */
async function verifySignature(rawBody, signature, propertyId) {
  const row    = await prisma.propertySetting.findUnique({
    where: { propertyId_key: { propertyId, key: 'lineChannelSecret' } },
  });
  const secret = row?.value || process.env.LINE_CHANNEL_SECRET;
  if (!secret) return false;
  const hash = crypto.createHmac('SHA256', secret).update(rawBody).digest('base64');
  return hash === signature;
}

/**
 * POST /webhook/line/:propertyId
 * รับ event จาก LINE OA ของแต่ละหอพัก
 */
exports.handleLine = async (req, res) => {
  const { propertyId } = req.params;

  // ตรวจสอบว่า property มีอยู่จริงและ active
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, isActive: true },
  });
  if (!property || !property.isActive) {
    return res.status(404).json({ error: 'Property not found' });
  }

  const rawBody   = req.body;
  const signature = req.headers['x-line-signature'];

  const sigOk = await verifySignature(rawBody, signature, propertyId);
  if (!sigOk) {
    console.warn(`[LINE] Invalid signature for property ${propertyId}`);
    return res.status(403).json({ error: 'Invalid signature' });
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Bad JSON' });
  }

  // ตอบ LINE ทันที (ต้องไม่เกิน 5 วินาที)
  res.status(200).end();

  // Process events
  for (const event of body.events ?? []) {
    try {
      await processEvent(event, propertyId);
    } catch (err) {
      console.error(`[LINE] Event error (property ${propertyId}):`, err.message);
    }
  }
};

async function processEvent(event, propertyId) {
  const { type, source, replyToken } = event;
  const lineUserId = source?.userId;
  if (!lineUserId) return;

  if (type === 'message' && event.message?.type === 'image') {
    await handleSlip(event, lineUserId, propertyId);
    return;
  }

  if (type === 'message' && event.message?.type === 'text') {
    const text = event.message.text.trim();

    if (text === 'บิล' || text === 'ยอด') {
      await handleInvoiceQuery(lineUserId, replyToken, propertyId);
      return;
    }

    // ผู้เช่าพิมพ์เลขห้อง เช่น "101" หรือ "ห้อง 101"
    const roomMatch = text.match(/^(?:ห้อง\s*)?(\d+(?:\/\d+)?)$/);
    if (roomMatch) {
      await handleRegister(lineUserId, replyToken, roomMatch[1], propertyId);
      return;
    }

    await replyText(replyToken,
      'สวัสดีครับ 👋\n' +
      'พิมพ์ตัวเลขห้องของคุณที่เจ้าของห้องพักแจ้ง เช่น 149/19 \n' +
      'หรือพิมพ์ "บิล" เพื่อดูยอดค้างชำระ',
      propertyId
    );
  }
}

async function handleRegister(lineUserId, replyToken, roomNumber, propertyId) {
  const contract = await prisma.contract.findFirst({
    where: {
      isActive: true,
      room: { roomNumber, propertyId },   // scoped to this property
    },
    include: { tenant: true, room: true },
  });

  if (!contract) {
    await replyText(replyToken,
      `❌ ไม่พบห้อง ${roomNumber} หรือห้องไม่มีผู้เช่าอยู่\nกรุณาติดต่อแอดมิน`,
      propertyId
    );
    return;
  }

  await prisma.tenant.update({
    where: { id: contract.tenantId },
    data:  { lineUserId },
  });

  await replyText(replyToken,
    `✅ ลงทะเบียนสำเร็จ!\n` +
    `ห้อง: ${roomNumber}\n` +
    `ชื่อ: ${contract.tenant.name}\n\n` +
    `พิมพ์ "บิล" เพื่อดูยอดค้างชำระได้เลยครับ 🙏`,
    propertyId
  );
}

async function handleSlip(event, lineUserId, propertyId) {
  const { replyToken, message } = event;

  const tenant = await prisma.tenant.findFirst({
    where: {
      lineUserId,
      contracts: { some: { isActive: true, room: { propertyId } } },  // scoped
    },
    include: {
      contracts: {
        where: { isActive: true, room: { propertyId } },
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
    await replyText(replyToken,
      'ไม่พบข้อมูลผู้เช่าของท่านในระบบ กรุณาติดต่อแอดมิน',
      propertyId
    );
    return;
  }

  const latestInvoice = tenant.contracts[0]?.invoices[0];
  if (!latestInvoice) {
    await replyText(replyToken, 'ไม่พบใบแจ้งหนี้ที่รอชำระ ขอบคุณครับ/ค่ะ', propertyId);
    return;
  }

  const slipPath = await downloadLineImage(message.id, propertyId);

  await prisma.invoice.update({
    where: { id: latestInvoice.id },
    data:  { status: 'REVIEW', slipPath },
  });

  await replyText(replyToken,
    '✅ ได้รับสลิปเรียบร้อยแล้ว\nแอดมินจะตรวจสอบและยืนยันการชำระภายใน 24 ชั่วโมง\nขอบคุณครับ/ค่ะ 🙏',
    propertyId
  );
}

async function handleInvoiceQuery(lineUserId, replyToken, propertyId) {
  const tenant = await prisma.tenant.findFirst({
    where: {
      lineUserId,
      contracts: { some: { isActive: true, room: { propertyId } } },  // scoped
    },
    include: {
      contracts: {
        where: { isActive: true, room: { propertyId } },
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
    await replyText(replyToken, '✅ ไม่มียอดค้างชำระในขณะนี้ ขอบคุณครับ/ค่ะ', propertyId);
    return;
  }

  const monthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
                      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const room   = tenant.contracts[0].room;
  const status = invoice.status === 'REVIEW' ? '⏳ รอตรวจสอบสลิป' : '🔴 รอชำระเงิน';

  await replyText(replyToken,
    `📋 ยอดค้างชำระห้อง ${room.roomNumber}\n` +
    `เดือน: ${monthNames[invoice.month - 1]} ${invoice.year + 543}\n` +
    `ยอดรวม: ฿${Number(invoice.totalAmount).toLocaleString('th-TH')}\n` +
    `สถานะ: ${status}\n\n` +
    `กรุณาส่งรูปสลิปในแชทนี้เพื่อยืนยันการชำระ`,
    propertyId
  );
}
