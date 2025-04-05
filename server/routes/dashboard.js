const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const db = req.app.get('db');
    const userId = req.user?.id;
    console.log(userId);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID missing in token' });
    }

    // Fetch user data
    const userResult = await db.query(
      'SELECT name, email, score FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Fetch quiz attempts
    const attemptsResult = await db.query(
      'SELECT topic, course, score, attempted_at FROM quiz_attempts WHERE user_id = $1 ORDER BY attempted_at DESC',
      [userId]
    );

    const attempts = attemptsResult.rows;

    // Return combined data
    res.json({
      name: user.name,
      email: user.email,
      score: user.score,
      attempts: attempts,
    });
  } catch (err) {
    console.error('Error in dashboard route:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
