const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createInvoice, getEffectiveRates } = require('../services/billingService');
const { pushInvoiceMessage } = require('../services/lineService');

exports.list = async (req, res, next) => {
  try {
    const { status, month, year } = req.query;
    const where = req.propertyId ? { contract: { room: { propertyId: req.propertyId } } } : {};
    if (status) where.status = status;
    if (month)  where.month  = Number(month);
    if (year)   where.year   = Number(year);

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        items:    true,
        contract: { include: { tenant: true, room: true } },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(invoices);
  } catch (e) { next(e); }
};

exports.get = async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { id: req.params.id, contract: { room: { propertyId: req.propertyId } } },
      include: {
        items:    { orderBy: { sortOrder: 'asc' } },
        contract: { include: { tenant: true, room: true } },
      },
    });
    res.json(invoice);
  } catch (e) { next(e); }
};

exports.create = async (req, res, next) => {
  try {
    const { contractId, month, year, dueDate, note, items, waterSaleIds } = req.body;
    if (!contractId || !month || !year || !items?.length) {
      return res.status(400).json({ error: 'contractId, month, year and items are required' });
    }
    const invoice = await createInvoice({ contractId, month: Number(month), year: Number(year), dueDate, note, items });

    // Link unpaid water sales to this invoice
    if (Array.isArray(waterSaleIds) && waterSaleIds.length) {
      await prisma.waterSale.updateMany({
        where: { id: { in: waterSaleIds }, isPaid: false },
        data:  { invoiceId: invoice.id },
      });
    }

    res.status(201).json(invoice);
  } catch (e) { next(e); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body; // PENDING | REVIEW | PAID
    const exists = await prisma.invoice.findFirst({ where: { id: req.params.id, contract: { room: { propertyId: req.propertyId } } } });
    if (!exists) return res.status(404).json({ error: 'ไม่พบใบแจ้งหนี้' });
    const data = { status };
    if (status === 'PAID') data.paidAt = new Date();
    const invoice = await prisma.invoice.update({ where: { id: req.params.id }, data });

    // เมื่อยืนยันชำระ → mark รายการน้ำดื่มที่ผูกกับใบนี้ว่าชำระแล้ว
    if (status === 'PAID') {
      await prisma.waterSale.updateMany({
        where: { invoiceId: req.params.id, isPaid: false },
        data:  { isPaid: true, paidAt: new Date() },
      });
    }

    res.json(invoice);
  } catch (e) { next(e); }
};

exports.pushLine = async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        items:    { orderBy: { sortOrder: 'asc' } },
        contract: { include: { tenant: true, room: true } },
      },
    });

    const lineUserId = invoice.contract.tenant.lineUserId;
    if (!lineUserId) return res.status(400).json({ error: 'Tenant has no Line User ID' });

    await pushInvoiceMessage(lineUserId, invoice, req.propertyId);
    res.json({ ok: true });
  } catch (e) { next(e); }
};

exports.remove = async (req, res, next) => {
  try {
    const exists = await prisma.invoice.findFirst({ where: { id: req.params.id, contract: { room: { propertyId: req.propertyId } } } });
    if (!exists) return res.status(404).json({ error: 'ไม่พบใบแจ้งหนี้' });
    await prisma.invoice.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
};

// แนบสลิปการโอน → ตั้งสถานะเป็น REVIEW อัตโนมัติ
exports.uploadSlip = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์สลิป' });
    const slipPath = `uploads/slips/${req.file.filename}`;
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { slipPath, status: 'REVIEW' },
    });
    res.json(invoice);
  } catch (e) { next(e); }
};

// Helper: return effective rates for a contract's room (used by frontend)
exports.getRates = async (req, res, next) => {
  try {
    const { contractId } = req.params;
    const contract = await prisma.contract.findFirstOrThrow({ where: { id: contractId, room: { propertyId: req.propertyId } } });
    const rates = await getEffectiveRates(contract.roomId);
    res.json(rates);
  } catch (e) { next(e); }
};
