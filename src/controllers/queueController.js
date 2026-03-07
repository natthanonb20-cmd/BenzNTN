const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.list = async (req, res, next) => {
  try {
    const { status } = req.query;
    const where = { propertyId: req.propertyId };
    if (status) where.status = status;
    const queue = await prisma.waitingQueue.findMany({
      where,
      orderBy: { queueNumber: 'asc' },
    });
    res.json(queue);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, nickname, phone, lineUserId, note } = req.body;
    if (!name) return res.status(400).json({ error: 'กรุณาระบุชื่อ' });

    // Auto-increment queue number per property
    const last = await prisma.waitingQueue.findFirst({
      where:   { propertyId: req.propertyId },
      orderBy: { queueNumber: 'desc' },
    });
    const queueNumber = (last?.queueNumber ?? 0) + 1;

    const entry = await prisma.waitingQueue.create({
      data: { propertyId: req.propertyId, queueNumber, name, nickname, phone, lineUserId, note },
    });
    res.status(201).json(entry);
  } catch (e) { next(e); }
};

exports.update = async (req, res, next) => {
  try {
    const { name, nickname, phone, lineUserId, note, status } = req.body;
    const exists = await prisma.waitingQueue.findFirst({ where: { id: req.params.id, propertyId: req.propertyId } });
    if (!exists) return res.status(404).json({ error: 'ไม่พบรายการคิว' });
    const entry = await prisma.waitingQueue.update({
      where: { id: req.params.id },
      data: { name, nickname, phone, lineUserId, note, status },
    });
    res.json(entry);
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    const exists = await prisma.waitingQueue.findFirst({ where: { id: req.params.id, propertyId: req.propertyId } });
    if (!exists) return res.status(404).json({ error: 'ไม่พบรายการคิว' });
    await prisma.waitingQueue.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
};

/**
 * POST /api/queue/:id/convert
 * แปลงคิวเป็นผู้เช่า — สร้าง Tenant จากข้อมูลคิว
 */
exports.convert = async (req, res, next) => {
  try {
    const entry = await prisma.waitingQueue.findFirst({ where: { id: req.params.id, propertyId: req.propertyId } });
    if (!entry) return res.status(404).json({ error: 'ไม่พบรายการคิว' });

    const tenant = await prisma.tenant.create({
      data: {
        propertyId: req.propertyId,
        name:      entry.name,
        nickname:  entry.nickname,
        phone:     entry.phone,
        lineUserId: entry.lineUserId || null,
        note:      entry.note,
      },
    });

    await prisma.waitingQueue.update({
      where: { id: req.params.id },
      data:  { status: 'CONVERTED', convertedId: tenant.id },
    });

    res.status(201).json({ tenant });
  } catch (e) { next(e); }
};

exports.stats = async (req, res, next) => {
  try {
    const waiting = await prisma.waitingQueue.count({ where: { propertyId: req.propertyId, status: 'WAITING' } });
    res.json({ waiting });
  } catch (e) { next(e); }
};
