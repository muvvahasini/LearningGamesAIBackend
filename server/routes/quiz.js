const express = require('express');
const jwt = require('jsonwebtoken');
const Groq = require('groq-sdk');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../db');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Fetch 15 quiz questions based on user's score (adaptive difficulty)
router.get('/quiz', auth, async (req, res) => {
  const db = req.app.get('db');
  const userId = req.userId;

  try {
    const userScore = await db.query('SELECT score FROM users WHERE id = $1', [userId]);
    const score = userScore.rows[0]?.score || 0;

    let difficulty = 'easy';
    if (score > 50) difficulty = 'medium';
    if (score > 80) difficulty = 'hard';

    const result = await db.query(
      'SELECT * FROM questions WHERE difficulty = $1 ORDER BY RANDOM() LIMIT 5',
      [difficulty]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Quiz fetch failed:', err.message);
    res.status(500).json({ error: 'Quiz fetch failed!' });
  }
});

// Fetch one random quiz question
router.get('/', auth, async (req, res) => {
  const db = req.app.get('db');

  try {
    const result = await db.query('SELECT * FROM questions ORDER BY RANDOM() LIMIT 1');
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Random quiz fetch failed:', err.message);
    res.status(500).json({ error: 'Quiz fetch failed!' });
  }
});

// Get user score
router.get('/user/score', auth, async (req, res) => {
  const db = req.app.get('db');

  try {
    const result = await db.query('SELECT score FROM users WHERE id = $1', [req.userId]);
    res.json({ score: result.rows[0].score });
  } catch (error) {
    console.error("Score fetch error:", error);
    res.status(500).json({ error: "Score fetch failed!" });
  }
});

// Update user score
router.post('/user/score', auth, async (req, res) => {
  const { score } = req.body;
  const db = req.app.get('db');

  try {
    await db.query('UPDATE users SET score = score + $1 WHERE id = $2', [score, req.userId]);
    res.json({ message: "Score updated!" });
  } catch (error) {
    console.error("Score update error:", error);
    res.status(500).json({ error: "Score update failed!" });
  }
});

// Leaderboard - Top 10 users
router.get('/leaderboard', auth, async (req, res) => {
  const db = req.app.get('db');

  try {
    const result = await db.query(
      'SELECT id, name, score FROM users ORDER BY score DESC LIMIT 10'
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Leaderboard fetch error:", error);
    res.status(500).json({ error: "Leaderboard fetch failed!" });
  }
});

// Generate quiz using Groq AI based on user-selected topic
// POST /api/quiz/generate-topics
router.post('/generate-topics', auth, async (req, res) => {
  const { grade, course, topic } = req.body;

  try {
    // Handle request to generate topics based on grade & course
    if (grade && course) {
      const prompt = `Suggest 15 interesting and relevant ${course} topics for grade ${grade} students. Return as a JSON array.`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that returns clean JSON arrays only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'llama3-70b-8192',
      });

      const topics = JSON.parse(completion.choices[0].message.content.trim());
      return res.json({ topics });
    }

    // Handle request to generate quiz questions based on topic
    if (topic) {
      const prompt = `Generate 15 multiple-choice quiz questions with 4 options each (A-D) and one correct answer for the topic "${topic}". Return as a JSON array like [{question, options: [A,B,C,D], answer}].`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You return quiz questions as clean JSON arrays only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'llama3-70b-8192',
      });

      const questions = JSON.parse(completion.choices[0].message.content.trim());
      return res.json({ questions });
    }

    return res.status(400).json({ error: 'Missing parameters: grade & course OR topic required.' });
  } catch (error) {
    console.error('Error in /generate-topics:', error.message);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});


// Submit quiz answers and calculate score
router.post("/submit", auth, async (req, res) => {
  const { answers, correctAnswers } = req.body;
  const userId = req.userId;

  // Ensure answers and correctAnswers are arrays and match in length
  if (!Array.isArray(answers) || !Array.isArray(correctAnswers)) {
    return res.status(400).json({ error: "Answers and correctAnswers must be arrays" });
  }

  if (answers.length !== correctAnswers.length) {
    return res.status(400).json({ error: "Answers and correctAnswers must have the same length" });
  }

  try {
    let score = 0;
    correctAnswers.forEach((correct, index) => {
      if (answers[index] === correct) {
        score += 1;
      }
    });

    console.log("Received body:", req.body);

    // Save score 
    await req.app
      .get("db")
      .query("UPDATE users SET score = $1 WHERE id = $2", [score, userId]);

    res.json({ score });
  } catch (err) {
    console.error("Quiz submission failed:", err.message);
    res.status(500).json({ error: "Quiz submission failed" });
  }
});


router.post('/attempt', auth, async (req, res) => {
  const { topic, course, score } = req.body;
  const userId = req.user.id;
  console.log(userId);
  try {
    await pool.query(
      'INSERT INTO quiz_attempts (user_id, topic, course, score) VALUES ($1, $2, $3, $4)',
      [userId, topic, course, score]
    );
    res.status(201).json({ message: 'Quiz attempt saved' });
  } catch (error) {
    console.error('Error saving quiz attempt:', error);
    res.status(500).json({ error: 'Failed to save quiz attempt' });
  }
});


module.exports = router;
