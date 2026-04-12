const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const prisma = new PrismaClient();

// ── Multer ───────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = 'uploads/repairs';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `repair-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('อนุญาตเฉพาะรูปภาพ'));
    cb(null, true);
  },
});

// ── Admin: list ──────────────────────────────────────────────────
async function list(req, res) {
  const { status, priority } = req.query;
  const where = { propertyId: req.propertyId };
  if (status)   where.status   = status;
  if (priority) where.priority = priority;

  const items = await prisma.repairRequest.findMany({
    where,
    include: {
      tenant: { select: { id: true, name: true, nickname: true } },
    },
    orderBy: [
      { status: 'asc' },
      { priority: 'desc' },
      { createdAt: 'desc' },
    ],
  });
  res.json(items);
}

// ── Admin: update status / note ──────────────────────────────────
async function updateStatus(req, res) {
  const { status, adminNote, priority } = req.body;
  const item = await prisma.repairRequest.findFirst({
    where: { id: req.params.id, propertyId: req.propertyId },
  });
  if (!item) return res.status(404).json({ error: 'ไม่พบรายการ' });

  const data = {};
  if (status)    { data.status = status; if (status === 'DONE' || status === 'REJECTED') data.closedAt = new Date(); }
  if (adminNote !== undefined) data.adminNote = adminNote;
  if (priority)  data.priority = priority;

  const updated = await prisma.repairRequest.update({ where: { id: item.id }, data });
  res.json(updated);
}

// ── Admin: delete ────────────────────────────────────────────────
async function remove(req, res) {
  const item = await prisma.repairRequest.findFirst({
    where: { id: req.params.id, propertyId: req.propertyId },
  });
  if (!item) return res.status(404).json({ error: 'ไม่พบรายการ' });
  await prisma.repairRequest.delete({ where: { id: item.id } });
  res.json({ ok: true });
}

// ── LIFF (tenant): create ────────────────────────────────────────
async function create(req, res) {
  const { title, description, priority } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'กรุณาระบุหัวข้อ' });

  const tenant   = req.tenant;
  const contract = tenant.contracts?.[0];

  const item = await prisma.repairRequest.create({
    data: {
      propertyId:  tenant.propertyId,
      tenantId:    tenant.id,
      roomId:      contract?.roomId ?? null,
      title:       title.trim(),
      description: description?.trim() || null,
      priority:    priority || 'NORMAL',
      imagePath:   req.file ? `/uploads/repairs/${req.file.filename}` : null,
    },
  });
  res.status(201).json(item);
}

// ── LIFF (tenant): list my requests ─────────────────────────────
async function listMine(req, res) {
  const items = await prisma.repairRequest.findMany({
    where: { tenantId: req.tenant.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  res.json(items);
}

module.exports = { upload, list, updateStatus, remove, create, listMine };
