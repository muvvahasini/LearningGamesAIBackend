const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../db');

// GET current user profile
router.get('/me', auth, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID missing in token' });
    }

    const userResult = await db.query(
      'SELECT name, email, score, bio FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    const attemptsResult = await db.query(
      'SELECT topic, course, score, attempted_at FROM quiz_attempts WHERE user_id = $1 ORDER BY attempted_at DESC',
      [userId]
    );

    const attempts = attemptsResult.rows;

    res.json({
      name: user.name,
      email: user.email,
      score: user.score,
      bio: user.bio,
      attempts: attempts,
    });
  } catch (err) {
    console.error('Error in dashboard route:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT update profile (bio and name)
router.put('/', auth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const { name, bio } = req.body;
  
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: User ID missing in token' });
      }
  
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Name is required and must be a string' });
      }
  
      await db.query(
        'UPDATE users SET name = $1, bio = $2 WHERE id = $3',
        [name, bio || '', userId]
      );
  
      res.json({ message: 'Profile updated successfully' });
    } catch (err) {
      console.error('Error updating profile:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
  

module.exports = router;
