const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * LIFF Auth — ตรวจสอบ LINE Access Token + หา tenant
 *
 * Client ส่งมา:
 *   Authorization: Bearer <LINE_ACCESS_TOKEN>
 *   x-property-id: <propertyId>
 *
 * ผลลัพธ์:
 *   req.lineUserId  — LINE userId จาก token
 *   req.tenant      — Tenant record (มี contract, room, bankAccount)
 *   req.propertyId  — propertyId
 */
async function liffAuth(req, res, next) {
  const header     = req.headers['authorization'] || '';
  const lineToken  = header.startsWith('Bearer ') ? header.slice(7) : null;
  const propertyId = req.headers['x-property-id'] || req.query.pid;

  if (!lineToken)  return res.status(401).json({ error: 'ต้องส่ง LINE access token' });
  if (!propertyId) return res.status(400).json({ error: 'ต้องระบุ property id' });

  // ตรวจสอบ token กับ LINE API
  let lineUserId;
  try {
    const r = await fetch(
      `https://api.line.me/oauth2/v2.1/verify?access_token=${lineToken}`
    );
    if (!r.ok) return res.status(401).json({ error: 'LINE token ไม่ถูกต้องหรือหมดอายุ' });
    const data = await r.json();
    lineUserId = data.sub; // LINE userId
  } catch {
    return res.status(502).json({ error: 'ไม่สามารถตรวจสอบ LINE token ได้' });
  }

  // หา tenant จาก lineUserId + propertyId
  const tenant = await prisma.tenant.findFirst({
    where: { lineUserId, propertyId },
    include: {
      bankAccount: true,
      contracts: {
        where: { isActive: true },
        include: { room: true },
        take: 1,
      },
    },
  });

  if (!tenant) {
    return res.status(404).json({
      error: 'ไม่พบข้อมูลผู้เช่า กรุณาติดต่อเจ้าของหอพัก',
      code: 'TENANT_NOT_FOUND',
    });
  }

  req.lineUserId = lineUserId;
  req.tenant     = tenant;
  req.propertyId = propertyId;
  next();
}

module.exports = { liffAuth };
