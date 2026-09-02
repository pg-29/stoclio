const express = require('express');
const controller = require('../controllers/market.controller');

const router = express.Router();
router.get('/search', controller.fnoSearch);
router.get('/futures', controller.fnoFutures);
router.get('/expiries', controller.fnoExpiries);
router.get('/depth/:symbol', controller.fnoDepth);
router.get('/history/:symbol', controller.fnoHistory);
router.get('/:symbol', controller.fno);

module.exports = router;