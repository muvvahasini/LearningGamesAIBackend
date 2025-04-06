const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  console.log('Auth middleware: Headers:', req.headers);
  const token = req.headers.authorization?.split(' ')[1];
  console.log('Auth middleware: Extracted token:', token);

  if (!token) {
    console.log('Auth middleware: No token provided');
    return res.status(401).json({ error: "Please login!" });
  }

  if (!process.env.JWT_SECRET) {
    console.error('Auth middleware: JWT_SECRET not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Auth middleware: Decoded token:', decoded);
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    console.error('Auth middleware: Token verification error:', error.message);
    return res.status(401).json({ error: "Invalid token!" });
  }
};

module.exports = auth;