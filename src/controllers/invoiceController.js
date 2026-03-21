const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createInvoice, getEffectiveRates } = require('../services/billingService');
const { pushInvoiceMessage } = require('../services/lineService');
const XLSX = require('xlsx');

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
    let invoice;
    try {
      invoice = await createInvoice({ contractId, month: Number(month), year: Number(year), dueDate, note, items });
    } catch (e) {
      if (e?.code === 'P2002') {
        const MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
        return res.status(409).json({ error: `มีใบแจ้งหนี้เดือน${MONTHS_TH[Number(month)-1]} ${Number(year)+543} ของห้องนี้อยู่แล้ว\nกรุณาตรวจสอบในหน้าใบแจ้งหนี้` });
      }
      throw e;
    }

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

exports.updateItems = async (req, res, next) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, contract: { room: { propertyId: req.propertyId } } },
    });
    if (!invoice) return res.status(404).json({ error: 'ไม่พบใบแจ้งหนี้' });
    if (invoice.status === 'PAID') return res.status(400).json({ error: 'ไม่สามารถแก้ไขบิลที่ชำระแล้ว' });

    const { items, dueDate, note } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'กรุณาระบุรายการ' });
    }

    // คำนวณยอดรวมใหม่
    const totalAmount = items.reduce((sum, i) => sum + Number(i.amount), 0);

    await prisma.$transaction([
      // ลบ items เก่าทั้งหมด แล้วสร้างใหม่
      prisma.invoiceItem.deleteMany({ where: { invoiceId: req.params.id } }),
      prisma.invoice.update({
        where: { id: req.params.id },
        data: {
          totalAmount,
          dueDate: dueDate ? new Date(dueDate) : invoice.dueDate,
          note: note ?? invoice.note,
          items: {
            create: items.map((item, idx) => ({
              label:         item.label,
              billingType:   item.billingType || 'FIXED',
              amount:        Number(item.amount),
              unitRate:      item.unitRate      ? Number(item.unitRate)      : null,
              previousMeter: item.previousMeter ? Number(item.previousMeter) : null,
              currentMeter:  item.currentMeter  ? Number(item.currentMeter)  : null,
              unitUsed:      item.unitUsed       ? Number(item.unitUsed)      : null,
              sortOrder:     idx,
            })),
          },
        },
      }),
    ]);

    const updated = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: { items: { orderBy: { sortOrder: 'asc' } }, contract: { include: { tenant: true, room: true } } },
    });
    res.json(updated);
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
    if (!lineUserId) return res.status(400).json({ error: 'ยังไม่ได้ตั้งค่า LINE ID ของผู้เช่า\nกรุณาไปแก้ไขข้อมูลผู้เช่าแล้วกรอก LINE User ID' });

    const propertyId = invoice.contract.room.propertyId || req.propertyId;
    await pushInvoiceMessage(lineUserId, invoice, propertyId);
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

exports.rejectSlip = async (req, res, next) => {
  try {
    const exists = await prisma.invoice.findFirst({ where: { id: req.params.id, contract: { room: { propertyId: req.propertyId } } } });
    if (!exists) return res.status(404).json({ error: 'ไม่พบใบแจ้งหนี้' });
    if (exists.slipPath) {
      const fs = require('fs');
      const fullPath = require('path').join(process.cwd(), exists.slipPath);
      fs.unlink(fullPath, () => {});
    }
    const invoice = await prisma.invoice.update({
      where: { id: req.params.id },
      data: { slipPath: null, status: 'PENDING' },
    });
    res.json(invoice);
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

// Export invoices to Excel
exports.exportExcel = async (req, res, next) => {
  try {
    const { status, month, year } = req.query;
    const MONTHS_TH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const STATUS_TH = { PENDING: 'รอชำระ', REVIEW: 'รอตรวจสลิป', PAID: 'ชำระแล้ว' };
    const where = { contract: { room: { propertyId: req.propertyId } } };
    if (status) where.status = status;
    if (month)  where.month  = Number(month);
    if (year)   where.year   = Number(year);

    const invoices = await prisma.invoice.findMany({
      where,
      include: { contract: { include: { tenant: true, room: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    const rows = invoices.map(inv => ({
      'ห้อง':           inv.contract?.room?.roomNumber ?? '',
      'ผู้เช่า':         inv.contract?.tenant?.name    ?? '',
      'เบอร์โทร':        inv.contract?.tenant?.phone   ?? '',
      'งวด':            `${MONTHS_TH[inv.month - 1]} ${inv.year + 543}`,
      'ยอด (฿)':        Number(inv.totalAmount),
      'สถานะ':          STATUS_TH[inv.status] ?? inv.status,
      'ครบกำหนด':       inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('th-TH') : '',
      'ชำระวันที่':      inv.paidAt  ? new Date(inv.paidAt).toLocaleDateString('th-TH')  : '',
    }));

    const wb  = XLSX.utils.book_new();
    const ws  = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [10,20,14,12,14,14,14,14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'ใบแจ้งหนี้');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="invoices.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
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
