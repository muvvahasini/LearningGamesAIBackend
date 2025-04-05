const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: "Please login!" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id }; // ✅ cleaner, follows convention
    console.log(decoded.iat);
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token!" });
  }
};

module.exports = auth;
