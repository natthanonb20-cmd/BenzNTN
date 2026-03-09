const router  = require('express').Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { adminAuth } = require('../middleware/auth');
const ctrl    = require('../controllers/invoiceController');

router.use(adminAuth);

// Multer for slip uploads
const slipStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'slips');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `slip_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const slipUpload = multer({ storage: slipStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/',               ctrl.list);
router.get('/:id',            ctrl.get);
router.post('/',              ctrl.create);        // สร้างบิลพร้อม items
router.put('/:id',            ctrl.updateItems);   // แก้ไขรายการในบิล
router.put('/:id/status',     ctrl.updateStatus);  // อัปเดตสถานะ (PAID ฯลฯ)
router.post('/:id/slip',      slipUpload.single('slip'), ctrl.uploadSlip); // แนบสลิป
router.post('/:id/push-line', ctrl.pushLine);      // ส่ง Flex Message แจ้งผู้เช่า
router.delete('/:id',         ctrl.remove);

// ดึง effective rates สำหรับห้องของ contract (ใช้ใน billing.html)
router.get('/rates/:contractId', ctrl.getRates);

module.exports = router;
