const router = require('express').Router();
const { masterAdminAuth } = require('../middleware/auth');
const ctrl = require('../controllers/adminController');

router.use(masterAdminAuth);

// Stats
router.get('/stats', ctrl.stats);

// Pending registrations
router.get('/pending',                       ctrl.listPending);
router.post('/properties/:id/approve',       ctrl.approveProperty);
router.post('/properties/:id/reject',        ctrl.rejectProperty);

// Properties
router.get('/properties',        ctrl.listProperties);
router.post('/properties',       ctrl.createProperty);
router.put('/properties/:id',    ctrl.updateProperty);

// Subscriptions
router.get('/properties/:id/subscription', ctrl.getSubscription);
router.put('/properties/:id/subscription', ctrl.updateSubscription);

// Users
router.get('/users',      ctrl.listUsers);
router.post('/users',     ctrl.createUser);
router.put('/users/:id',  ctrl.updateUser);

module.exports = router;
