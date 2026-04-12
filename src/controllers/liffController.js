const { PrismaClient } = require('@prisma/client');
const jwt    = require('jsonwebtoken');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const prisma = new PrismaClient();

// ── Multer config สำหรับสลิปจาก LIFF ───────────────────────────
const slipStorage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = 'uploads/slips';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `slip-${Date.now()}${ext}`);
  },
});
const slipUpload = multer({
  storage: slipStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ'));
    }
    cb(null, true);
  },
});

// ── GET /api/liff/me ─────────────────────────────────────────────
async function getMe(req, res) {
  const { tenant } = req;
  const contract = tenant.contracts[0] || null;

  // invoice ล่าสุด (PENDING ก่อน ถ้าไม่มีให้เอาอันล่าสุด)
  let currentInvoice = null;
  if (contract) {
    currentInvoice = await prisma.invoice.findFirst({
      where: { contractId: contract.id, status: 'PENDING' },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!currentInvoice) {
      currentInvoice = await prisma.invoice.findFirst({
        where: { contractId: contract.id },
        include: { items: { orderBy: { sortOrder: 'asc' } } },
        orderBy: { createdAt: 'desc' },
      });
    }
  }

  console.log('[getMe]', { id: tenant.id, name: tenant.name, nickname: tenant.nickname, room: contract?.room?.roomNumber });
  res.json({
    id:          tenant.id,
    name:        tenant.name,
    nickname:    tenant.nickname,
    phone:       tenant.phone,
    billDueDay:  tenant.billDueDay,
    bankAccount: tenant.bankAccount,
    room:        contract?.room    ?? null,
    contract:    contract ? {
      id:        contract.id,
      startDate: contract.startDate,
      endDate:   contract.endDate,
    } : null,
    currentInvoice,
  });
}

// ── GET /api/liff/invoices ───────────────────────────────────────
async function listInvoices(req, res) {
  const { tenant } = req;
  const contract = tenant.contracts[0];
  if (!contract) return res.json([]);

  const invoices = await prisma.invoice.findMany({
    where: { contractId: contract.id },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    take: 24,
  });
  res.json(invoices);
}

// ── GET /api/liff/invoices/:id ───────────────────────────────────
async function getInvoice(req, res) {
  const { tenant } = req;
  const contract = tenant.contracts[0];
  if (!contract) return res.status(404).json({ error: 'ไม่มีสัญญาเช่า' });

  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, contractId: contract.id },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!invoice) return res.status(404).json({ error: 'ไม่พบใบแจ้งหนี้' });
  res.json(invoice);
}

// ── POST /api/liff/invoices/:id/slip ────────────────────────────
async function uploadSlip(req, res) {
  const { tenant } = req;
  const contract = tenant.contracts[0];
  if (!contract) return res.status(404).json({ error: 'ไม่มีสัญญาเช่า' });

  const invoice = await prisma.invoice.findFirst({
    where: { id: req.params.id, contractId: contract.id, status: 'PENDING' },
  });
  if (!invoice) return res.status(404).json({ error: 'ไม่พบใบแจ้งหนี้ที่รอชำระ' });

  if (!req.file) return res.status(400).json({ error: 'กรุณาแนบรูปสลิป' });

  const slipPath = `/uploads/slips/${req.file.filename}`;
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { slipPath, status: 'REVIEW', paidAt: new Date() },
  });
  res.json({ ok: true, slipPath });
}

// ── POST /api/liff/invite/accept ────────────────────────────────
// รับ invite token แล้ว link lineUserId → tenant
async function acceptInvite(req, res) {
  const { inviteToken, lineAccessToken, propertyId } = req.body;
  if (!inviteToken || !lineAccessToken || !propertyId) {
    return res.status(400).json({ error: 'ข้อมูลไม่ครบ' });
  }

  // ตรวจสอบ LINE token
  let lineUserId;
  try {
    const r = await fetch(
      `https://api.line.me/oauth2/v2.1/verify?access_token=${lineAccessToken}`,
      { headers: { 'ngrok-skip-browser-warning': '1' } }
    );
    if (!r.ok) return res.status(401).json({ error: 'LINE token ไม่ถูกต้อง' });
    const data = await r.json().catch(() => ({}));
    lineUserId = data.sub;
    if (!lineUserId) return res.status(401).json({ error: 'ดึง LINE User ID ไม่ได้' });
  } catch {
    return res.status(502).json({ error: 'ตรวจสอบ LINE token ไม่ได้' });
  }

  // ตรวจสอบ invite token (JWT)
  let payload;
  try {
    payload = jwt.verify(inviteToken, process.env.JWT_SECRET);
    if (payload.type !== 'invite') throw new Error('wrong type');
  } catch {
    return res.status(400).json({ error: 'Invite link ไม่ถูกต้องหรือหมดอายุ' });
  }

  const { tenantId, propertyId: invPropertyId } = payload;
  if (invPropertyId !== propertyId) {
    return res.status(400).json({ error: 'Property ไม่ตรงกัน' });
  }

  // ตรวจว่า lineUserId นี้ยังไม่ถูกใช้ในหอนี้
  const existingOther = await prisma.tenantLineUser.findFirst({
    where: { lineUserId, tenant: { propertyId }, NOT: { tenantId } },
  });
  if (existingOther) {
    return res.status(409).json({ error: 'LINE นี้ถูกลงทะเบียนกับผู้เช่าท่านอื่นแล้ว' });
  }

  // ตรวจว่า LINE นี้ link กับห้องนี้อยู่แล้วหรือเปล่า
  const alreadyLinked = await prisma.tenantLineUser.findFirst({
    where: { tenantId, lineUserId },
  });
  if (alreadyLinked) {
    return res.json({ ok: true, message: 'ลงทะเบียนสำเร็จแล้ว' });
  }

  // จำกัดไม่เกิน 2 คนต่อห้อง
  const count = await prisma.tenantLineUser.count({ where: { tenantId } });
  if (count >= 2) {
    return res.status(400).json({ error: 'ห้องนี้มีผู้ใช้งาน LINE ครบ 2 คนแล้ว กรุณาติดต่อเจ้าของหอพัก' });
  }

  // Link lineUserId → tenant (ผ่าน TenantLineUser)
  await prisma.tenantLineUser.create({
    data: { tenantId, lineUserId },
  });
  // อัปเดต legacy field ด้วย (สำหรับ backward compat)
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { lineUserId },
  }).catch(() => {});

  res.json({ ok: true, message: 'ลงทะเบียนสำเร็จ' });
}

// ── GET /api/liff/invite/generate/:tenantId (admin only) ────────
async function generateInvite(req, res) {
  const { tenantId } = req.params;
  const propertyId   = req.propertyId;

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, propertyId },
  });
  if (!tenant) return res.status(404).json({ error: 'ไม่พบผู้เช่า' });

  const token = jwt.sign(
    { type: 'invite', tenantId, propertyId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const liffId  = process.env.LIFF_ID || '';
  const baseUrl = process.env.BASE_URL || '';

  // ถ้ามี LIFF_ID → ส่ง liff.line.me link; ถ้าไม่มี → fallback web link
  const inviteUrl = liffId
    ? `https://liff.line.me/${liffId}?invite=${token}&pid=${propertyId}`
    : `${baseUrl}/tenant-app/?invite=${token}&pid=${propertyId}`;

  res.json({ inviteUrl, expiresIn: '7 วัน' });
}

module.exports = {
  slipUpload,
  getMe,
  listInvoices,
  getInvoice,
  uploadSlip,
  acceptInvite,
  generateInvite,
};
