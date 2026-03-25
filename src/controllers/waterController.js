const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/** ดึงราคาน้ำดื่มจาก PropertySetting (fallback defaults) */
async function getWaterPrices(propertyId) {
  const rows = await prisma.propertySetting.findMany({
    where: { propertyId, key: { in: ['waterSmallPrice', 'waterLargePrice', 'waterSmallLabel', 'waterLargeLabel'] } },
  });
  const m = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return {
    smallPrice: parseFloat(m.waterSmallPrice  ?? '15'),
    largePrice: parseFloat(m.waterLargePrice  ?? '25'),
    smallLabel: m.waterSmallLabel ?? 'แพ็คเล็ก',
    largeLabel: m.waterLargeLabel ?? 'แพ็คใหญ่',
  };
}
exports.getWaterPrices = getWaterPrices;

/** GET /api/water?date=YYYY-MM-DD&tenantId=&isPaid= */
exports.list = async (req, res, next) => {
  try {
    const { date, tenantId, isPaid } = req.query;
    const where = { propertyId: req.propertyId };
    if (tenantId) where.tenantId = tenantId;
    if (isPaid !== undefined) where.isPaid = isPaid === 'true';
    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end   = new Date(date); end.setHours(23, 59, 59, 999);
      where.saleDate = { gte: start, lte: end };
    }
    const sales = await prisma.waterSale.findMany({
      where,
      include: { tenant: { select: { id: true, name: true, nickname: true } } },
      orderBy: { saleDate: 'desc' },
    });
    res.json(sales);
  } catch (e) { next(e); }
};

/** GET /api/water/prices */
exports.prices = async (req, res, next) => {
  try { res.json(await getWaterPrices(req.propertyId)); } catch (e) { next(e); }
};

/** GET /api/water/stats?date=YYYY-MM-DD */
exports.stats = async (req, res, next) => {
  try {
    const dateStr = req.query.date ?? new Date().toISOString().slice(0, 10);
    const start   = new Date(dateStr); start.setHours(0, 0, 0, 0);
    const end     = new Date(dateStr); end.setHours(23, 59, 59, 999);

    const [todaySales, unpaidTotal] = await Promise.all([
      prisma.waterSale.findMany({
        where: { propertyId: req.propertyId, saleDate: { gte: start, lte: end } },
        select: { totalAmount: true, isPaid: true, smallPacks: true, largePacks: true },
      }),
      prisma.waterSale.aggregate({
        where: { propertyId: req.propertyId, isPaid: false },
        _sum:  { totalAmount: true },
      }),
    ]);

    const todayRevenue    = todaySales.reduce((s, x) => s + Number(x.totalAmount), 0);
    const todayUnits      = todaySales.reduce((s, x) => s + x.smallPacks + x.largePacks, 0);
    const todaySmallPacks = todaySales.reduce((s, x) => s + x.smallPacks, 0);
    const todayLargePacks = todaySales.reduce((s, x) => s + x.largePacks, 0);
    res.json({
      todayRevenue,
      todayUnits,
      todaySmallPacks,
      todayLargePacks,
      todaySalesCount: todaySales.length,
      unpaidTotal: Number(unpaidTotal._sum.totalAmount ?? 0),
    });
  } catch (e) { next(e); }
};

/** GET /api/water/unpaid/:tenantId — รายการค้างชำระของผู้เช่า */
exports.unpaidByTenant = async (req, res, next) => {
  try {
    const sales = await prisma.waterSale.findMany({
      where: { propertyId: req.propertyId, tenantId: req.params.tenantId, isPaid: false, invoiceId: null },
      orderBy: { saleDate: 'asc' },
    });
    const total = sales.reduce((s, x) => s + Number(x.totalAmount), 0);
    res.json({ sales, total });
  } catch (e) { next(e); }
};

/** POST /api/water */
exports.create = async (req, res, next) => {
  try {
    const { tenantId, saleDate, smallPacks, largePacks, isPaid, note } = req.body;
    if (!tenantId) return res.status(400).json({ error: 'กรุณาระบุผู้เช่า' });
    if (!smallPacks && !largePacks) return res.status(400).json({ error: 'กรุณาระบุจำนวนอย่างน้อย 1 รายการ' });

    const prices = await getWaterPrices();
    const total  = (Number(smallPacks ?? 0) * prices.smallPrice) + (Number(largePacks ?? 0) * prices.largePrice);

    const sale = await prisma.waterSale.create({
      data: {
        propertyId: req.propertyId,
        tenantId,
        saleDate:    saleDate ? new Date(saleDate) : new Date(),
        smallPacks:  Number(smallPacks ?? 0),
        largePacks:  Number(largePacks ?? 0),
        totalAmount: total,
        isPaid:      isPaid === true || isPaid === 'true',
        paidAt:      (isPaid === true || isPaid === 'true') ? new Date() : null,
        note:        note ?? null,
      },
      include: { tenant: { select: { id: true, name: true, nickname: true } } },
    });
    res.status(201).json(sale);
  } catch (e) { next(e); }
};

/** PUT /api/water/:id */
exports.update = async (req, res, next) => {
  try {
    const { smallPacks, largePacks, isPaid, note, saleDate } = req.body;
    const exists = await prisma.waterSale.findFirst({ where: { id: req.params.id, propertyId: req.propertyId } });
    if (!exists) return res.status(404).json({ error: 'ไม่พบรายการน้ำดื่ม' });
    const prices = await getWaterPrices();
    const total  = (Number(smallPacks ?? 0) * prices.smallPrice) + (Number(largePacks ?? 0) * prices.largePrice);
    const sale   = await prisma.waterSale.update({
      where: { id: req.params.id },
      data: {
        saleDate:    saleDate ? new Date(saleDate) : undefined,
        smallPacks:  smallPacks !== undefined ? Number(smallPacks) : undefined,
        largePacks:  largePacks !== undefined ? Number(largePacks) : undefined,
        totalAmount: total,
        isPaid:      isPaid !== undefined ? (isPaid === true || isPaid === 'true') : undefined,
        paidAt:      isPaid === true || isPaid === 'true' ? new Date() : undefined,
        note:        note !== undefined ? note : undefined,
      },
      include: { tenant: { select: { id: true, name: true, nickname: true } } },
    });
    res.json(sale);
  } catch (e) { next(e); }
};

/** PUT /api/water/:id/pay — mark as cash paid */
exports.markPaid = async (req, res, next) => {
  try {
    const exists = await prisma.waterSale.findFirst({ where: { id: req.params.id, propertyId: req.propertyId } });
    if (!exists) return res.status(404).json({ error: 'ไม่พบรายการน้ำดื่ม' });
    const sale = await prisma.waterSale.update({
      where: { id: req.params.id },
      data:  { isPaid: true, paidAt: new Date() },
    });
    res.json(sale);
  } catch (e) { next(e); }
};

/** DELETE /api/water/:id */
exports.remove = async (req, res, next) => {
  try {
    const exists = await prisma.waterSale.findFirst({ where: { id: req.params.id, propertyId: req.propertyId } });
    if (!exists) return res.status(404).json({ error: 'ไม่พบรายการน้ำดื่ม' });
    await prisma.waterSale.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
};
