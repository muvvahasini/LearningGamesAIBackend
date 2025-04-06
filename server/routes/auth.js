const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4} =  require('uuid');
const router = express.Router();


const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "please Login!" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token!" });
  }
};


router.post('/signup', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });

  const { name, email, password } = req.body;
  const db = req.app.get('db');
  try {
    const hashedPassword = await bcrypt.hash(password, 12); // Increased salt rounds
    const userId = uuidv4();
    const result = await db.query(
      'INSERT INTO users (name, email, password, score) VALUES ($1, $2, $3, $4) RETURNING id',
      [userId, name, email, hashedPassword, 0]
    );
    const token = jwt.sign({ id: result.rows[0].id }, process.env.JWT_SECRET);
    res.json({ token, name, id: result.rows[0].id });
  } catch (err) {
    console.error("Signup failed:", err.message);
    res.status(500).json({ error: "Signup failed!" });
  }
});

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array() });

  const { email, password } = req.body;
  const db = req.app.get('db');
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid creds ra bey!' });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid creds ra bey!' });
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
    res.json({ token, name: user.name, id: user.id });
  } catch (err) {
    console.error('Login fail:', err.message);
    res.status(500).json({ error: 'Login fail!' });
  }
});

module.exports = router;

module.exports.auth = auth;