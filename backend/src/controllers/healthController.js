const mongoose = require('mongoose');

function getHealth(_req, res) {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected || !process.env.MONGODB_URI ? 200 : 503).json({
    status: databaseConnected || !process.env.MONGODB_URI ? 'ok' : 'degraded',
    service: 'stoclio-api',
    database: databaseConnected ? 'connected' : 'not-connected',
    timestamp: new Date().toISOString(),
  });
}

module.exports = { getHealth };
