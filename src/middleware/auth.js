const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * ตรวจสอบ JWT — แนบ req.user และ req.propertyId
 * JWT payload: { userId, propertyId, role }
 */
function adminAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    req.user       = jwt.verify(token, process.env.JWT_SECRET);
    req.propertyId = req.user.propertyId ?? null;
    next();
  } catch {
    res.status(401).json({ error: 'Token ไม่ถูกต้องหรือหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}

/**
 * เฉพาะ Property Admin — ต้องมี propertyId
 * fallback อ่านจาก DB กรณี token เก่าไม่มี propertyId
 */
function propertyAuth(req, res, next) {
  adminAuth(req, res, async () => {
    // MASTER_ADMIN → อ่าน propertyId จาก DB เสมอ (ไม่เชื่อ JWT เพราะอาจเก่า)
    if (req.user.role === 'MASTER_ADMIN') {
      try {
        const user = await prisma.user.findUnique({
          where: { id: req.user.userId },
          select: { propertyId: true },
        });
        if (user?.propertyId) {
          req.propertyId = user.propertyId;
        } else {
          // fallback: ถ้า user ไม่มี propertyId ให้ดึง property ล่าสุด
          const prop = await prisma.property.findFirst({ orderBy: { createdAt: 'desc' }, select: { id: true } });
          if (prop) req.propertyId = prop.id;
        }
      } catch {}
      return next();
    }

    if (req.propertyId) return next();

    // JWT เก่าอาจไม่มี propertyId — อ่านจาก DB แทน
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { propertyId: true },
      });
      if (user?.propertyId) {
        req.propertyId = user.propertyId;
        return next();
      }
    } catch {}

    return res.status(403).json({ error: 'ต้องเข้าสู่ระบบในฐานะเจ้าของหอพัก' });
  });
}

/**
 * เฉพาะ Master Admin — role === 'MASTER_ADMIN'
 */
function masterAdminAuth(req, res, next) {
  adminAuth(req, res, () => {
    if (req.user.role !== 'MASTER_ADMIN') {
      return res.status(403).json({ error: 'ต้องเข้าสู่ระบบในฐานะ Master Admin' });
    }
    next();
  });
}

module.exports = { adminAuth, propertyAuth, masterAdminAuth };
