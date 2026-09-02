const { validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

function validate(rules) {
  return [
    ...rules,
    (req, _res, next) => {
      const result = validationResult(req);
      if (!result.isEmpty()) {
        return next(new AppError('Request validation failed', 400, result.array().map(({ path, msg }) => ({ field: path, message: msg }))));
      }
      next();
    },
  ];
}

module.exports = { validate };
