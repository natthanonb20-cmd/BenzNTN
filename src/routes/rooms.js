const router = require('express').Router();
const { propertyAuth }                   = require('../middleware/auth');
const { checkSubscription, checkRoomLimit } = require('../middleware/propertyScope');
const ctrl = require('../controllers/roomController');

router.use(propertyAuth);

router.get('/',    ctrl.list);
router.get('/:id', ctrl.get);
router.post('/',   checkSubscription, checkRoomLimit, ctrl.create); // ตรวจ limit ก่อนสร้าง
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
