const router = require('express').Router();
const ctrl = require('../controllers/webhookController');

// LINE Platform จะ POST มาตาม propertyId ของแต่ละหอพัก
router.post('/line/:propertyId', ctrl.handleLine);

module.exports = router;
