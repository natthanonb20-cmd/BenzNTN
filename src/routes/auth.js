const router   = require('express').Router();
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { adminAuth }    = require('../middleware/auth');
const prisma = new PrismaClient();

/**
 * POST /api/auth/login
 * Body: { username, password }
 * Returns: { token, role, propertyId, propertyName }
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const user = await prisma.user.findUnique({
      where: { username },
      include: { property: { select: { id: true, name: true, isActive: true } } },
    });

    if (!user) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    // ตรวจสอบสถานะบัญชี (เฉพาะ PROPERTY_ADMIN)
    if (user.role === 'PROPERTY_ADMIN') {
      if (!user.isActive) {
        return res.status(403).json({ error: 'บัญชีของคุณยังรออนุมัติจากผู้ดูแลระบบ', code: 'PENDING_APPROVAL' });
      }
      if (!user.property || !user.property.isActive) {
        return res.status(403).json({ error: 'บัญชีหอพักถูกระงับ กรุณาติดต่อ Line: rotbenzzz เพื่อใช้งานต่อ', code: 'SUSPENDED' });
      }
      // ตรวจสอบ subscription หมดอายุ
      const sub = await prisma.subscription.findUnique({ where: { propertyId: user.propertyId } });
      if (sub?.expiresAt && sub.expiresAt < new Date()) {
        return res.status(403).json({ error: 'ครบกำหนดทดลองใช้งานแล้ว กรุณาติดต่อ Line: rotbenzzz เพื่อใช้งานต่อ', code: 'TRIAL_EXPIRED' });
      }
    }

    const token = jwt.sign(
      { userId: user.id, propertyId: user.propertyId, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '30d' },
    );

    res.json({
      token,
      role:         user.role,
      propertyId:   user.propertyId,
      propertyName: user.property?.name ?? null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => res.json({ ok: true }));

/**
 * PUT /api/auth/password
 * Body: { currentPassword, newPassword, newUsername? }
 */
router.put('/password', adminAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword, newUsername } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านปัจจุบันและรหัสผ่านใหม่' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashed,
        ...(newUsername ? { username: newUsername } : {}),
      },
    });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /api/auth/me — ดึงข้อมูล user ปัจจุบัน
 */
router.get('/me', adminAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where:   { id: req.user.userId },
      select:  { id: true, username: true, role: true, propertyId: true,
                 property: { select: { id: true, name: true } } },
    });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/auth/register
 * สมัครใช้งานหอดี — สร้าง Property + User + Subscription ใหม่
 * Body: { propertyName, ownerName?, phone?, address?,
 *         username, password, confirmPassword,
 *         lineChannelAccessToken?, lineChannelSecret? }
 */
router.post('/register', async (req, res) => {
  try {
    const {
      propertyName, ownerName, phone, address,
      username, password, confirmPassword,
      lineChannelAccessToken, lineChannelSecret,
    } = req.body;

    // Validate required fields
    if (!propertyName?.trim()) return res.status(400).json({ error: 'กรุณากรอกชื่อหอพัก' });
    if (!username?.trim())     return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้' });
    if (!password)             return res.status(400).json({ error: 'กรุณากรอกรหัสผ่าน' });
    if (password.length < 6)   return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
    if (password !== confirmPassword) return res.status(400).json({ error: 'รหัสผ่านไม่ตรงกัน' });

    // Check username uniqueness
    const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (existing) return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้งานแล้ว' });

    const hashed = await bcrypt.hash(password, 12);

    // Create Property + User + Subscription in one transaction
    const property = await prisma.$transaction(async (tx) => {
      const prop = await tx.property.create({
        data: {
          name:                   propertyName.trim(),
          ownerName:              ownerName?.trim()  || null,
          phone:                  phone?.trim()      || null,
          address:                address?.trim()    || null,
          lineChannelAccessToken: lineChannelAccessToken?.trim() || null,
          lineChannelSecret:      lineChannelSecret?.trim()      || null,
          isActive:               true, // อนุมัติอัตโนมัติ ทดลองใช้ 30 วัน
        },
      });

      await tx.user.create({
        data: {
          propertyId: prop.id,
          username:   username.trim(),
          password:   hashed,
          role:       'PROPERTY_ADMIN',
          isActive:   true, // อนุมัติอัตโนมัติ
        },
      });

      // FREE_TRIAL 30 วัน
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      await tx.subscription.create({
        data: {
          propertyId: prop.id,
          plan:       'FREE_TRIAL',
          roomLimit:  10,
          startDate:  new Date(),
          expiresAt,
          isActive:   true,
        },
      });

      // Default property settings
      await tx.propertySetting.createMany({
        data: [
          { propertyId: prop.id, key: 'electricRate', value: '8' },
          { propertyId: prop.id, key: 'waterRate',    value: '18' },
        ],
      });

      return prop;
    });

    // ไม่ออก token — รอ admin อนุมัติก่อน
    res.status(202).json({ pending: true, propertyName: property.name });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง' });
  }
});

module.exports = router;
