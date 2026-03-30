const router = require('express').Router();
const { propertyAuth } = require('../middleware/auth');
const ctrl = require('../controllers/bankAccountController');

router.use(propertyAuth);

router.get('/',       ctrl.list);
router.post('/',      ctrl.create);
router.put('/:id',    ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
