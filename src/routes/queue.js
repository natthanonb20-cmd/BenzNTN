const router = require('express').Router();
const { propertyAuth } = require('../middleware/auth');
const ctrl = require('../controllers/queueController');

router.use(propertyAuth);

router.get('/',          ctrl.list);
router.get('/stats',     ctrl.stats);
router.post('/',         ctrl.create);
router.put('/:id',       ctrl.update);
router.delete('/:id',    ctrl.remove);
router.post('/:id/convert', ctrl.convert);

module.exports = router;
