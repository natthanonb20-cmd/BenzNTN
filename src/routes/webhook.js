const router = require('express').Router();
const ctrl = require('../controllers/webhookController');

// Line Platform will POST here
router.post('/line', ctrl.handleLine);

module.exports = router;
