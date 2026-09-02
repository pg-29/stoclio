const express = require('express');
const controller = require('../controllers/market.controller');

const router = express.Router();

router.get('/search', controller.search);
router.get('/quote', controller.quote);
router.get('/candles', controller.candles);
router.get('/gainers', controller.gainers);
router.get('/losers', controller.losers);
router.get('/depth', controller.depth);
router.get('/depth/:symbol', controller.depthBySymbol);
router.get('/quotes', controller.quote);

module.exports = router;
