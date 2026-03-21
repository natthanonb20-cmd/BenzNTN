const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { downloadLineImage, replyText } = require('../services/lineService');
const { getWaterPrices } = require('./waterController');

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
  console.log(`[LINE] incoming event type=${type} userId=${lineUserId}`);
  if (!lineUserId) return;

  if (type === 'message' && event.message?.type === 'image') {
    await handleSlip(event, lineUserId, propertyId);
    return;
  }

  if (type === 'message' && event.message?.type === 'text') {
    const text = event.message.text.trim();

    if (text.toUpperCase() === 'LINEID') {
      await replyText(replyToken, `LINE ID ของคุณ:\n${lineUserId}`, propertyId);
      return;
    }

    if (text === 'บิล' || text === 'ยอด') {
      await handleInvoiceQuery(lineUserId, replyToken, propertyId);
      return;
    }

    // [DISABLED] บันทึกน้ำดื่มผ่าน LINE — ปิดไว้ชั่วคราว
    // const waterParsed = parseWaterOrder(text);
    // if (waterParsed) { ... }

    // ผู้เช่าพิมพ์เลขห้อง เช่น "101" หรือ "ห้อง 101"
    const roomMatch = text.match(/^(?:ห้อง\s*)?(\d+(?:\/\d+)?)$/);
    if (roomMatch) {
      await handleRegister(lineUserId, replyToken, roomMatch[1], propertyId);
      return;
    }

    await replyText(replyToken,
      'สวัสดีครับ 🏠\nติดต่อเรื่องอะไรดีครับ?\n\n' +
      '📋 พิมพ์ "บิล" — ดูยอดค้างชำระ\n' +
      '🔑 พิมพ์ "LINEID" — ขอรหัสสำหรับลงทะเบียน',
      propertyId
    );
  }
}

/**
 * เช็คว่า lineUserId มีสิทธิ์บันทึกน้ำดื่มหรือไม่
 * ถ้า waterAdmins ตั้งไว้ → เช็ค list, ถ้าไม่ตั้ง → ทุกคนที่ไม่ใช่ผู้เช่า
 */
async function checkWaterAdmin(lineUserId, propertyId) {
  const row = await prisma.propertySetting.findUnique({
    where: { propertyId_key: { propertyId, key: 'waterAdmins' } },
  });
  if (row?.value) {
    const allowed = row.value.split(',').map(s => s.trim()).filter(Boolean);
    return allowed.includes(lineUserId);
  }
  // ไม่ได้ตั้ง waterAdmins → fallback: ทุกคนที่ไม่ใช่ผู้เช่า
  const isTenant = await prisma.tenant.findFirst({
    where: { lineUserId, contracts: { some: { isActive: true, room: { propertyId } } } },
  });
  return !isTenant;
}

/**
 * แยกว่าข้อความเป็นคำสั่งน้ำดื่มหรือไม่
 * รองรับ: "149/22 เล็ก 5", "149/22เล็ก5 จ่ายแล้ว", "บ้านแอน เล็ก 30=760"
 */
function parseWaterOrder(text) {
  const sizeMatch = text.match(/(เล็ก|ใหญ่)/);
  if (!sizeMatch) return null;

  const roomNumMatch = text.match(/(\d+\/\d+)/);
  const size = sizeMatch[1] === 'เล็ก' ? 'small' : 'large';

  // ดึงตัวเลขทั้งหมด (ไม่รวมส่วนเลขห้อง)
  const textWithoutRoom = roomNumMatch ? text.replace(roomNumMatch[1], '') : text;
  const allNums = [...textWithoutRoom.matchAll(/=?\s*(\d+)\s*บาท?/g), ...textWithoutRoom.matchAll(/(?<![=/\d])(\d+)(?!\s*บาท)/g)];
  const nums = [...new Set(textWithoutRoom.match(/\d+/g)?.map(Number) ?? [])];

  if (nums.length === 0) return null;

  let qty, statedPrice;
  if (nums.length === 1) {
    qty = nums[0];
    statedPrice = null;
  } else {
    // ถ้ามี =number หรือ numberบาท → นั่นคือราคา
    const priceByEq   = textWithoutRoom.match(/=\s*(\d+)/);
    const priceByBaht = textWithoutRoom.match(/(\d+)\s*บาท/);
    if (priceByEq) {
      statedPrice = Number(priceByEq[1]);
      qty = nums.find(n => n !== statedPrice) ?? nums[0];
    } else if (priceByBaht) {
      statedPrice = Number(priceByBaht[1]);
      qty = nums.find(n => n !== statedPrice) ?? nums[0];
    } else {
      // ตัวเลขเล็กสุด = qty, ใหญ่สุด = ราคา
      qty = Math.min(...nums);
      statedPrice = Math.max(...nums);
    }
  }

  const isPaid = statedPrice !== null || /จ่ายแล้ว|ชำระแล้ว/.test(text);

  if (roomNumMatch) {
    return { type: 'tenant', room: roomNumMatch[1], size, qty, statedPrice, isPaid: /จ่ายแล้ว|ชำระแล้ว/.test(text) };
  }

  // Walk-in: เอาชื่อออกจากข้อความ (ส่วนที่ไม่ใช่ตัวเลข/keyword)
  const customerName = text
    .replace(/(เล็ก|ใหญ่|แพ็ค|จ่ายแล้ว|ชำระแล้ว|บาท)/g, '')
    .replace(/[=\d]/g, '')
    .trim() || 'ลูกค้าทั่วไป';

  return { type: 'walkin', customerName, size, qty, statedPrice, isPaid };
}

async function handleWaterOrder(lineUserId, replyToken, originalText, parsed, propertyId) {
  const prices = await getWaterPrices();
  const unitPrice  = parsed.size === 'small' ? prices.smallPrice : prices.largePrice;
  const sizeLabel  = parsed.size === 'small' ? prices.smallLabel : prices.largeLabel;
  const calcAmount = unitPrice * parsed.qty;

  let tenantId;
  let displayName;

  if (parsed.type === 'tenant') {
    const contract = await prisma.contract.findFirst({
      where: { isActive: true, room: { roomNumber: parsed.room, propertyId } },
      include: { tenant: true },
    });
    if (!contract) {
      await replyText(replyToken, `❌ ไม่พบห้อง ${parsed.room} หรือไม่มีผู้เช่า`, propertyId);
      return;
    }
    tenantId    = contract.tenantId;
    displayName = `ห้อง ${parsed.room} (${contract.tenant.name})`;
  } else {
    // Walk-in → ใช้ dummy tenant "ลูกค้าทั่วไป" ของ property นี้
    let walkIn = await prisma.tenant.findFirst({
      where: { name: 'ลูกค้าทั่วไป', propertyId },
    });
    if (!walkIn) {
      walkIn = await prisma.tenant.create({ data: { name: 'ลูกค้าทั่วไป', propertyId } });
    }
    tenantId    = walkIn.id;
    displayName = parsed.customerName;
  }

  const recordAmount = parsed.statedPrice ?? calcAmount;

  await prisma.waterSale.create({
    data: {
      propertyId,
      tenantId,
      smallPacks:  parsed.size === 'small' ? parsed.qty : 0,
      largePacks:  parsed.size === 'large'  ? parsed.qty : 0,
      totalAmount: recordAmount,
      isPaid:      parsed.isPaid,
      note:        `LINE: ${originalText}`,
    },
  });

  // สร้าง reply
  let msg = `✅ บันทึกแล้ว\n${displayName}\n${sizeLabel}: ${parsed.qty} แพ็ค\n`;

  if (parsed.statedPrice !== null) {
    msg += `ราคาที่พิม: ฿${parsed.statedPrice.toLocaleString('th-TH')}\n`;
    msg += `ระบบคำนวณ: ฿${calcAmount.toLocaleString('th-TH')} (${parsed.qty} × ฿${unitPrice})\n`;
    const diff = parsed.statedPrice - calcAmount;
    if (diff !== 0) {
      msg += `⚠️ ต่างกัน ฿${Math.abs(diff).toLocaleString('th-TH')} กรุณาตรวจสอบ`;
    } else {
      msg += `✓ ราคาถูกต้อง`;
    }
  } else {
    msg += `ยอด: ฿${calcAmount.toLocaleString('th-TH')}`;
  }

  msg += parsed.isPaid ? '\n💚 จ่ายแล้ว' : '\n🔴 ค้างชำระ';

  await replyText(replyToken, msg, propertyId);
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
  if (!latestInvoice) return; // ไม่มีบิล PENDING → เงียบ ไม่ตอบ

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
