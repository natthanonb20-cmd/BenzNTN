const router = require('express').Router();
const { propertyAuth } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const axios  = require('axios');
const prisma = new PrismaClient();

router.use(propertyAuth);

/**
 * GET /api/settings
 * ดึง settings ของ property นั้นๆ
 */
router.get('/', async (req, res, next) => {
  try {
    const settings = await prisma.propertySetting.findMany({
      where: { propertyId: req.propertyId },
    });
    res.json(Object.fromEntries(settings.map(s => [s.key, s.value])));
  } catch (e) { next(e); }
});

/**
 * PUT /api/settings/:key
 * บันทึก setting ของ property นั้นๆ
 */
router.put('/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const setting = await prisma.propertySetting.upsert({
      where: { propertyId_key: { propertyId: req.propertyId, key } },
      update: { value },
      create: { propertyId: req.propertyId, key, value },
    });
    res.json(setting);
  } catch (e) { next(e); }
});

/**
 * POST /api/settings/line-save
 * บันทึก LINE credentials + ตั้ง webhook URL อัตโนมัติ
 * Body: { lineChannelSecret, lineChannelAccessToken }
 */
router.post('/line-save', async (req, res, next) => {
  try {
    const { lineChannelSecret, lineChannelAccessToken } = req.body;
    if (!lineChannelSecret || !lineChannelAccessToken) {
      return res.status(400).json({ error: 'กรุณาระบุ Channel Secret และ Access Token' });
    }

    const propertyId = req.propertyId;

    // 1. บันทึก credentials ลง DB
    await prisma.$transaction([
      prisma.propertySetting.upsert({
        where:  { propertyId_key: { propertyId, key: 'lineChannelSecret' } },
        update: { value: lineChannelSecret },
        create: { propertyId, key: 'lineChannelSecret', value: lineChannelSecret },
      }),
      prisma.propertySetting.upsert({
        where:  { propertyId_key: { propertyId, key: 'lineChannelAccessToken' } },
        update: { value: lineChannelAccessToken },
        create: { propertyId, key: 'lineChannelAccessToken', value: lineChannelAccessToken },
      }),
    ]);

    // 2. สร้าง webhook URL สำหรับ property นี้
    const baseUrl    = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
    const webhookUrl = `${baseUrl}/webhook/line/${propertyId}`;

    console.log('[LINE] webhookUrl to set:', webhookUrl);

    // 3. ตั้ง webhook URL ใน LINE อัตโนมัติ
    try {
      await axios.put(
        'https://api.line.me/v2/bot/channel/webhook/endpoint',
        { endpoint: webhookUrl },
        { headers: { Authorization: `Bearer ${lineChannelAccessToken}` } }
      );

      // 4. เปิด webhook ให้ active (บางครั้ง LINE ต้องการขั้นตอนนี้เพิ่ม)
      await axios.put(
        'https://api.line.me/v2/bot/channel/webhook/test',
        { endpoint: webhookUrl },
        { headers: { Authorization: `Bearer ${lineChannelAccessToken}` } }
      ).catch(() => {}); // ไม่ต้อง error ถ้า test ไม่ผ่าน

      res.json({ ok: true, webhookUrl, autoSetup: true });
    } catch (lineErr) {
      // บันทึก credentials สำเร็จแล้ว แต่ set webhook ไม่ได้ (token อาจผิด)
      const data = lineErr.response?.data || {};
      const details = data.details?.map(d => d.message).filter(Boolean).join(', ') || '';
      const msg = [data.message, details].filter(Boolean).join(' — ') || 'ไม่สามารถตั้ง webhook อัตโนมัติได้';
      console.error('LINE webhook setup error:', JSON.stringify(lineErr.response?.data));
      res.json({ ok: true, webhookUrl, autoSetup: false, warning: msg });
    }
  } catch (e) { next(e); }
});

/**
 * POST /api/settings/line-test
 * ทดสอบ LINE Channel Access Token
 */
router.post('/line-test', async (req, res, next) => {
  try {
    const token = req.body.lineChannelAccessToken;
    if (!token) return res.status(400).json({ error: 'กรุณาระบุ Channel Access Token' });

    const r = await axios.get('https://api.line.me/v2/bot/info', {
      headers: { Authorization: `Bearer ${token}` },
    });
    res.json({ displayName: r.data.displayName, pictureUrl: r.data.pictureUrl });
  } catch (e) {
    const msg = e.response?.data?.message || 'Token ไม่ถูกต้องหรือหมดอายุ';
    res.status(400).json({ error: msg });
  }
});

/**
 * POST /api/settings/line-test-send
 * ส่ง test LINE message ไปยัง lineUserId ที่ระบุ
 * Body: { lineUserId, invoiceId (optional) }
 */
router.post('/line-test-send', async (req, res, next) => {
  try {
    const { lineUserId } = req.body;
    if (!lineUserId) return res.status(400).json({ error: 'กรุณาระบุ lineUserId' });

    const propertyId = req.propertyId;

    // Get property info
    const prop = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!prop) return res.status(404).json({ error: 'Property not found' });

    // Create dummy invoice for testing
    const now = new Date();
    const testInvoice = {
      id: 'test-' + Date.now(),
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      totalAmount: 1500,
      dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      items: [
        { label: 'ค่าไฟฟ้า', amount: 800, billingType: 'FIXED', previousMeter: null, currentMeter: null, unitUsed: null, unitRate: null },
        { label: 'ค่าน้ำ (ประปา)', amount: 300, billingType: 'FIXED', previousMeter: null, currentMeter: null, unitUsed: null, unitRate: null },
        { label: 'ค่าปรับปรุง', amount: 400, billingType: 'FIXED', previousMeter: null, currentMeter: null, unitUsed: null, unitRate: null },
      ],
      contract: {
        tenant: { name: 'ผู้เช่าทดสอบ', lineUserId },
        room: { roomNumber: '101', propertyId },
      },
    };

    // Load LINE service
    const { pushInvoiceMessage } = require('../services/lineService');

    // ส่ง message
    try {
      await pushInvoiceMessage(lineUserId, testInvoice, propertyId);
      res.json({ ok: true, msg: `✅ ส่ง test message ไป ${lineUserId} สำเร็จ!` });
    } catch (lineErr) {
      console.error('LINE push error:', lineErr.message, JSON.stringify(lineErr.originalError?.response?.data || lineErr.response?.data));
      res.status(400).json({ error: `ไม่สามารถส่ง LINE message ได้: ${lineErr.message}` });
    }
  } catch (e) { next(e); }
});

module.exports = router;
