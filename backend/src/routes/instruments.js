const express = require('express');
const controller = require('../controllers/market.controller');

const router = express.Router();
router.get('/search', controller.search);

module.exports = router;