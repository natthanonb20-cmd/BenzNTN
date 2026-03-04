const router = require('express').Router();
const { adminAuth } = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');
const axios  = require('axios');
const prisma = new PrismaClient();

router.use(adminAuth);

router.get('/', async (req, res, next) => {
  try {
    const settings = await prisma.setting.findMany();
    res.json(Object.fromEntries(settings.map(s => [s.key, s.value])));
  } catch (e) { next(e); }
});

router.put('/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    res.json(setting);
  } catch (e) { next(e); }
});

/**
 * POST /api/settings/line-test
 * Body: { lineChannelAccessToken, lineChannelSecret? }
 * Tests the token against LINE's bot-info API.
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

module.exports = router;
