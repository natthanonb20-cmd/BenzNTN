const express    = require('express');
const router     = express.Router();
const { liffAuth }     = require('../middleware/liffAuth');
const { propertyAuth } = require('../middleware/auth');
const ctrl = require('../controllers/liffController');

// ── Public (ไม่ต้อง auth) ────────────────────────────────────────
// รับ invite link → link LINE userId กับ tenant
router.post('/invite/accept', ctrl.acceptInvite);

// ── Admin: สร้าง invite link ─────────────────────────────────────
router.get('/invite/generate/:tenantId', propertyAuth, ctrl.generateInvite);

// ── Tenant (LIFF auth) ────────────────────────────────────────────
router.get('/me',                    liffAuth, ctrl.getMe);
router.get('/invoices',              liffAuth, ctrl.listInvoices);
router.get('/invoices/:id',          liffAuth, ctrl.getInvoice);
router.post('/invoices/:id/slip',    liffAuth, ctrl.slipUpload.single('slip'), ctrl.uploadSlip);

module.exports = router;
