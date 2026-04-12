const router = require('express').Router();
const { propertyAuth } = require('../middleware/auth');
const ctrl = require('../controllers/waterController');
const orderCtrl = require('../controllers/waterOrderController');

router.use(propertyAuth);

router.get('/prices',          ctrl.prices);
router.get('/stats',           ctrl.stats);
router.get('/unpaid/:tenantId', ctrl.unpaidByTenant);
router.get('/',                ctrl.list);
router.post('/',               ctrl.create);
router.put('/:id/pay',         ctrl.markPaid);
router.put('/:id',             ctrl.update);
router.delete('/:id',          ctrl.remove);

// Slip review (admin)
router.post('/:id/approve-slip', orderCtrl.approveSlip);
router.post('/:id/reject-slip',  orderCtrl.rejectSlip);

module.exports = router;
