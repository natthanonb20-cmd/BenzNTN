const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * ตรวจสอบ Subscription ว่ายังใช้งานได้และไม่หมดอายุ
 * ใส่ไว้ใน middleware chain: propertyAuth, checkSubscription, controller
 */
async function checkSubscription(req, res, next) {
  try {
    const sub = await prisma.subscription.findUnique({
      where: { propertyId: req.propertyId },
    });

    if (!sub || !sub.isActive) {
      return res.status(403).json({
        error: 'แพ็กเกจการใช้งานไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ',
        code:  'SUBSCRIPTION_INACTIVE',
      });
    }

    if (sub.expiresAt && new Date() > sub.expiresAt) {
      return res.status(403).json({
        error: `แพ็กเกจหมดอายุเมื่อ ${sub.expiresAt.toLocaleDateString('th-TH')} กรุณาต่ออายุ`,
        code:  'SUBSCRIPTION_EXPIRED',
        expiresAt: sub.expiresAt,
      });
    }

    req.subscription = sub;
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * ตรวจสอบว่าจำนวนห้องไม่เกิน roomLimit ของแพ็กเกจ
 * ใส่ก่อน roomController.create เท่านั้น
 */
async function checkRoomLimit(req, res, next) {
  try {
    const sub = req.subscription;
    if (!sub) return next(); // ถ้าไม่ได้ผ่าน checkSubscription ก่อน

    const count = await prisma.room.count({
      where: { propertyId: req.propertyId, isActive: true },
    });

    if (count >= sub.roomLimit) {
      return res.status(403).json({
        error: `แพ็กเกจ ${sub.plan} รองรับสูงสุด ${sub.roomLimit} ห้อง (มีอยู่ ${count} ห้องแล้ว) กรุณาอัพเกรดแพ็กเกจ`,
        code:  'ROOM_LIMIT_EXCEEDED',
        current: count,
        limit:   sub.roomLimit,
      });
    }

    next();
  } catch (e) {
    next(e);
  }
}

module.exports = { checkSubscription, checkRoomLimit };
