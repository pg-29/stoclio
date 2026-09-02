const express = require('express');
const controller = require('../controllers/market.controller');

const router = express.Router();

router.get('/search', controller.search);
router.get('/status', controller.status);
router.get('/quote', controller.quote);
router.get('/candles', controller.candles);
router.get('/candles/:symbol', controller.candlesBySymbol);
router.get('/gainers', controller.gainers);
router.get('/losers', controller.losers);
router.get('/commodities', controller.commodities);
router.get('/stock/:symbol', controller.stock);
router.get('/fno/overview', controller.fnoOverview);
router.get('/fno/search', controller.fnoSearch);
router.get('/fno/greeks', controller.fnoGreeks);
router.get('/fno/:symbol', controller.fno);
router.get('/depth', controller.depth);
router.get('/depth/:symbol', controller.depthBySymbol);
router.get('/quotes', controller.quote);

module.exports = router;
