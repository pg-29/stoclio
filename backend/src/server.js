const http = require('http');
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');
const { Server } = require('socket.io');
const { port, clientUrl } = require('./config/env');
const { connectDatabase } = require('./config/database');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const marketRoutes = require('./routes/market');
const fnoRoutes = require('./routes/fno');
const watchlistRoutes = require('./routes/watchlist');
const angelStream = require('./services/angel.stream.service');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: clientUrl, credentials: true } });
app.use(helmet());
app.use(cors({ origin: clientUrl, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '20kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many requests, please try again later' } }));
app.use('/health', healthRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many authentication attempts, please try again later' } }), authRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/fno', fnoRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use(errorHandler);
io.on('connection', (socket) => {
  socket.on('subscribe:quotes', (symbols) => angelStream.subscribeClient(socket, symbols));
  socket.on('subscribe:depth', (symbol) => angelStream.subscribeDepthClient(socket, symbol));
  socket.on('market:heartbeat', () => socket.emit('market:heartbeat', { timestamp: Date.now() }));
});
async function start() {
  await connectDatabase();
  server.listen(port, () => console.log(`Stoclio API listening on ${port}`));
  setInterval(() => io.emit('market:heartbeat', { timestamp: Date.now() }), 15000);
}
start().catch((error) => { console.error('Startup failed', error); process.exit(1); });
