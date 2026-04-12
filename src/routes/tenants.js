const router = require('express').Router();
const { propertyAuth } = require('../middleware/auth');
const ctrl = require('../controllers/tenantController');

router.use(propertyAuth);

router.get('/export/excel', ctrl.exportExcel);
router.get('/',          ctrl.list);
router.get('/:id',       ctrl.get);
router.post('/',         ctrl.create);
router.put('/:id',       ctrl.update);
router.delete('/:id',    ctrl.remove);

// Contract sub-resource
router.post('/:id/contracts',                   ctrl.createContract);
router.put ('/:id/contracts/:contractId',        ctrl.updateContract);

// Revoke LINE access
router.delete('/:id/line-access', ctrl.revokeLineAccess);

// Vehicle sub-resource
router.get   ('/:id/vehicles',             ctrl.listVehicles);
router.post  ('/:id/vehicles',             ctrl.addVehicle);
router.delete('/:id/vehicles/:vehicleId',  ctrl.removeVehicle);

module.exports = router;
