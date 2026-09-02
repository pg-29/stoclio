class AppError extends Error {
  constructor(message, statusCode = 500, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = statusCode < 500;
  }
}

function errorHandler(error, req, res, _next) {
  const statusCode = error.statusCode || (error.name === 'ValidationError' ? 400 : error.code === 11000 ? 409 : 500);
  const message = statusCode === 500 ? 'Internal server error' : error.message;
  if (statusCode >= 500) console.error({ method: req.method, path: req.originalUrl, error: error.stack });
  else console.warn({ method: req.method, path: req.originalUrl, statusCode, message });
  res.status(statusCode).json({ message, error: { message, ...(error.details ? { details: error.details } : {}) } });
}

module.exports = { AppError, errorHandler };
