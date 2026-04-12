const express    = require('express');
const router     = express.Router();
const { propertyAuth } = require('../middleware/auth');
const ctrl = require('../controllers/repairController');

// Admin routes
router.get('/',        propertyAuth, ctrl.list);
router.put('/:id',     propertyAuth, ctrl.updateStatus);
router.delete('/:id',  propertyAuth, ctrl.remove);

module.exports = router;
