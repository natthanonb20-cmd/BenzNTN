const jwt = require('jsonwebtoken');

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
 * เฉพาะ Property Admin — ต้องมี propertyId ใน JWT
 */
function propertyAuth(req, res, next) {
  adminAuth(req, res, () => {
    if (!req.propertyId) {
      return res.status(403).json({ error: 'ต้องเข้าสู่ระบบในฐานะเจ้าของหอพัก' });
    }
    next();
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
