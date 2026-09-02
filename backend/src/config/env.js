const dotenv = require('dotenv');

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const required = ['JWT_SECRET', ...(isProduction ? ['MONGODB_URI'] : [])];

if (process.env.NODE_ENV === 'production') {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters in production');
}

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');

module.exports = {
  port,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || 'development-only-secret',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  angel: {
    apiKey: process.env.ANGEL_API_KEY,
    clientCode: process.env.ANGEL_CLIENT_CODE,
    pin: process.env.ANGEL_PIN,
    totpSecret: process.env.ANGEL_TOTP_SECRET,
    streamTokens: process.env.ANGEL_STREAM_TOKENS || '',
  },
};
