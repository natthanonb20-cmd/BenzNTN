const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getWaterPrices } = require('./waterController');
const { getLineClient } = require('../services/lineService');

/** GET /api/liff/water/prices */
exports.getPrices = async (req, res, next) => {
  try {
    const prices = await getWaterPrices(req.propertyId);
    res.json(prices);
  } catch (e) { next(e); }
};

/** POST /api/liff/water/order */
exports.create = async (req, res, next) => {
  try {
    const { smallPacks, largePacks, note } = req.body;
    const tenant = req.tenant;
    const contract = tenant.contracts?.[0];

    if (!smallPacks && !largePacks) {
      return res.status(400).json({ error: 'กรุณาระบุจำนวนอย่างน้อย 1 รายการ' });
    }

    const prices = await getWaterPrices(req.propertyId);
    const total = (Number(smallPacks ?? 0) * prices.smallPrice) +
                  (Number(largePacks ?? 0) * prices.largePrice);

    const sale = await prisma.waterSale.create({
      data: {
        propertyId:  req.propertyId,
        tenantId:    tenant.id,
        saleDate:    new Date(),
        smallPacks:  Number(smallPacks ?? 0),
        largePacks:  Number(largePacks ?? 0),
        totalAmount: total,
        isPaid:      false,
        note:        `📱 สั่งผ่าน LIFF${note ? ` | ${note}` : ''}`,
      },
    });

    // แจ้ง admin ทาง LINE
    try {
      const adminSetting = await prisma.propertySetting.findUnique({
        where: { propertyId_key: { propertyId: req.propertyId, key: 'adminLineUserId' } },
      });
      if (adminSetting?.value) {
        const adminIds = adminSetting.value.split(',').map(s => s.trim()).filter(Boolean);
        if (adminIds.length > 0) {
          const client = await getLineClient(req.propertyId);
          const roomNo = contract?.room?.roomNumber ?? '—';
          const name   = tenant.nickname || tenant.name;
          const lines  = [];
          if (Number(smallPacks ?? 0) > 0) lines.push(`• ${prices.smallLabel} x${smallPacks} = ฿${(Number(smallPacks) * prices.smallPrice).toFixed(0)}`);
          if (Number(largePacks ?? 0) > 0) lines.push(`• ${prices.largeLabel} x${largePacks} = ฿${(Number(largePacks) * prices.largePrice).toFixed(0)}`);
          const msg = `💧 สั่งน้ำดื่มใหม่!\n\n` +
                      `ผู้เช่า: ${name} (ห้อง ${roomNo})\n` +
                      lines.join('\n') + `\n` +
                      `รวม: ฿${total.toFixed(0)}\n` +
                      (note ? `หมายเหตุ: ${note}\n` : '') +
                      `\nกรุณานำส่งที่ห้อง ${roomNo}`;
          await Promise.all(adminIds.map(uid =>
            client.pushMessage(uid, { type: 'text', text: msg }).catch(e =>
              console.warn(`[waterOrder] LINE push to ${uid} failed:`, e.message)
            )
          ));
        }
      }
    } catch (lineErr) {
      console.warn('[waterOrder] LINE push failed:', lineErr.message);
    }

    res.status(201).json({ ok: true, sale });
  } catch (e) { next(e); }
};

/** GET /api/liff/water/orders — ประวัติการสั่งน้ำของผู้เช่า */
exports.listMine = async (req, res, next) => {
  try {
    const orders = await prisma.waterSale.findMany({
      where: { tenantId: req.tenant.id, note: { startsWith: '📱' } },
      orderBy: { saleDate: 'desc' },
      take: 20,
    });
    res.json(orders);
  } catch (e) { next(e); }
};
