const router = require('express').Router();
const { propertyAuth } = require('../middleware/auth');
const ctrl = require('../controllers/tenantController');

router.use(propertyAuth);

router.get('/',          ctrl.list);
router.get('/:id',       ctrl.get);
router.post('/',         ctrl.create);
router.put('/:id',       ctrl.update);
router.delete('/:id',    ctrl.remove);

// Contract sub-resource
router.post('/:id/contracts',                   ctrl.createContract);
router.put ('/:id/contracts/:contractId',        ctrl.updateContract);

module.exports = router;
