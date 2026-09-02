const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { jwtSecret } = require('../config/env');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { body } = require('express-validator');

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const tokenFor = (user) => jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '7d' });
const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, watchlist: user.watchlist });

function validateCredentials({ name, email, password }, requireName = false) {
  if (requireName && (!name || typeof name !== 'string' || name.trim().length < 2)) return 'Name must be at least 2 characters';
  if (!email || typeof email !== 'string' || !emailPattern.test(email.trim())) return 'A valid email address is required';
  if (!password || typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters';
  return null;
}

const registerValidation = validate([
  body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be between 2 and 80 characters'),
  body('email').isEmail().normalizeEmail().withMessage('A valid email address is required'),
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters'),
]);
const loginValidation = validate([
  body('email').isEmail().normalizeEmail().withMessage('A valid email address is required'),
  body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters'),
]);

router.post('/register', registerValidation, async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    const validationError = validateCredentials({ name, email, password }, true);
    if (validationError) return res.status(400).json({ message: validationError });
    const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), passwordHash: password, watchlist: ['NIFTY 50', 'RELIANCE', 'TCS'] });
    res.status(201).json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.post('/login', loginValidation, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const validationError = validateCredentials({ email, password });
    if (validationError) return res.status(400).json({ message: validationError });
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    if (!user || !(await user.comparePassword(password))) return res.status(401).json({ message: 'Invalid email or password' });
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.get('/me', protect, (req, res) => res.json(publicUser(req.user)));
router.post('/logout', protect, (_req, res) => res.status(204).send());

module.exports = router;
