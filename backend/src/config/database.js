const mongoose = require('mongoose');
const { mongodbUri } = require('./env');

async function connectDatabase() {
  if (!mongodbUri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI is required in production');
    }
    console.warn('MONGODB_URI is not configured; starting without a database connection.');
    return null;
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(mongodbUri, {
    serverSelectionTimeoutMS: 5000,
  });
  console.log('Connected to MongoDB Atlas');
  return mongoose.connection;
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connectDatabase, disconnectDatabase };
