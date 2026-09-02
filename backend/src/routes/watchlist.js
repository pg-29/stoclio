const express = require('express');
const { protect } = require('../middleware/auth');

const router = express.Router();
router.use(protect);
router.get('/', (req, res) => res.json({ data: req.user.watchlist }));
router.post('/:symbol', async (req, res, next) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    if (!req.user.watchlist.includes(symbol)) req.user.watchlist.push(symbol);
    await req.user.save();
    res.status(201).json({ data: req.user.watchlist });
  } catch (error) { next(error); }
});
router.delete('/:symbol', async (req, res, next) => {
  try {
    req.user.watchlist = req.user.watchlist.filter((symbol) => symbol !== req.params.symbol.toUpperCase());
    await req.user.save();
    res.json({ data: req.user.watchlist });
  } catch (error) { next(error); }
});
module.exports = router;
