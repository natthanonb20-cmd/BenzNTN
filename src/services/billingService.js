const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get the effective electric/water rate for a room.
 * Falls back to system Setting if the room has no custom rate.
 */
async function getEffectiveRates(roomId) {
  const [room, settings] = await Promise.all([
    prisma.room.findUniqueOrThrow({ where: { id: roomId } }),
    prisma.setting.findMany({ where: { key: { in: ['electricRate', 'waterRate'] } } }),
  ]);

  const settingMap = Object.fromEntries(settings.map(s => [s.key, parseFloat(s.value)]));
  return {
    electricRate: room.customElectricRate !== null
      ? parseFloat(room.customElectricRate)
      : (settingMap.electricRate ?? parseFloat(process.env.DEFAULT_ELECTRIC_RATE ?? '8')),
    waterRate: room.customWaterRate !== null
      ? parseFloat(room.customWaterRate)
      : (settingMap.waterRate ?? parseFloat(process.env.DEFAULT_WATER_RATE ?? '18')),
    monthlyRent: parseFloat(room.monthlyRent),
  };
}

/**
 * Calculate a METER billing item.
 * Returns { amount, unitUsed }
 */
function calcMeterItem(previousMeter, currentMeter, rate) {
  const unitUsed = Math.max(0, parseFloat(currentMeter) - parseFloat(previousMeter));
  const amount   = parseFloat((unitUsed * rate).toFixed(2));
  return { unitUsed, amount };
}

/**
 * Build and persist an Invoice with its InvoiceItems.
 *
 * @param {object} payload
 * @param {string}   payload.contractId
 * @param {number}   payload.month  (1–12)
 * @param {number}   payload.year
 * @param {string}   [payload.dueDate]  ISO date string
 * @param {string}   [payload.note]
 * @param {Array}    payload.items   — each item:
 *   {
 *     label:         string,
 *     billingType:   'METER' | 'FIXED',
 *     amount?:       number,         // required for FIXED
 *     unitRate?:     number,         // required for METER
 *     previousMeter?: number,        // required for METER
 *     currentMeter?:  number,        // required for METER
 *     sortOrder?:    number,
 *   }
 */
async function createInvoice({ contractId, month, year, dueDate, note, items }) {
  // Resolve any METER items that don't yet have amount computed
  const resolvedItems = items.map((item, idx) => {
    if (item.billingType === 'METER') {
      const { unitUsed, amount } = calcMeterItem(item.previousMeter, item.currentMeter, item.unitRate);
      return { ...item, unitUsed, amount, sortOrder: item.sortOrder ?? idx };
    }
    return { ...item, unitUsed: null, sortOrder: item.sortOrder ?? idx };
  });

  const totalAmount = resolvedItems.reduce((sum, i) => sum + parseFloat(i.amount), 0);

  const invoice = await prisma.invoice.create({
    data: {
      contractId,
      month,
      year,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      dueDate:     dueDate ? new Date(dueDate) : null,
      note:        note ?? null,
      status:      'PENDING',
      items: {
        create: resolvedItems.map(item => ({
          label:         item.label,
          billingType:   item.billingType,
          amount:        item.amount,
          unitRate:      item.unitRate    ?? null,
          previousMeter: item.previousMeter ?? null,
          currentMeter:  item.currentMeter  ?? null,
          unitUsed:      item.unitUsed      ?? null,
          sortOrder:     item.sortOrder,
        })),
      },
    },
    include: {
      items:    true,
      contract: { include: { tenant: true, room: true } },
    },
  });

  return invoice;
}

module.exports = { getEffectiveRates, calcMeterItem, createInvoice };
