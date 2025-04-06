const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const Groq = require('groq-sdk');
const auth = require('../middleware/auth');
const db = require('../db');

dotenv.config();

const app = express();
app.use(bodyParser.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DEFAULT_QUESTION_COUNT = 15;

// Fallback questions (extended to 15)
const fallbackQuestions = Array(DEFAULT_QUESTION_COUNT).fill().map((_, i) => ({
  question: `Sample fallback question ${i + 1}?`,
  options: ["Option A", "Option B", "Option C", "Option D"],
  answer: "Option A"
}));

// Extract and validate individual question objects
function validateQuizData(rawText) {
  const questionRegex = /{[^{}]*"question"[^{}]*"options"[^{}]*"answer"[^{}]*}/g;
  const matches = rawText.match(questionRegex) || [];

  const parsedQuestions = matches.map((match, idx) => {
    try {
      const obj = JSON.parse(match.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'));
      if (
        typeof obj.question === 'string' &&
        Array.isArray(obj.options) &&
        obj.options.length === 4 &&
        typeof obj.answer === 'string' &&
        obj.options.includes(obj.answer)
      ) {
        return obj;
      }
    } catch (_) {
      console.warn(`Invalid JSON object at index ${idx}`);
    }
    return null;
  }).filter(Boolean);

  if (parsedQuestions.length === 0) throw new Error("No valid questions extracted");

  return parsedQuestions.slice(0, DEFAULT_QUESTION_COUNT);
}

// Clean AI response (light cleanup)
function cleanUpAiResponse(content) {
  return content
    .replace(/[\r\n\t]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Create router
const router = express.Router();

router.post('/create', auth, async (req, res) => {
  try {
    const { prompt } = req.body;
    console.log("Prompt received:", prompt);

    const response = await groq.chat.completions.create({
      model: 'llama3-70b-8192',
      messages: [
        {
          role: 'user',
          content: `ONLY return a JSON array with 10-15 objects, no other text.

          Each object must follow:
          {
            "question": "...",
            "options": ["...", "...", "...", "..."],
            "answer": "..."
          }

          The array must start with [ and end with ] — NO backticks or extra text.

          Topic: ${prompt}`
        }
      ],
      max_tokens: 800,
      temperature: 0.2,
    });

    const rawContent = response?.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("AI response is missing");

    console.log("Raw AI Response:", rawContent);
    const cleanedContent = cleanUpAiResponse(rawContent);
    console.log("Cleaned Content:", cleanedContent);

    const validQuizData = validateQuizData(cleanedContent);

    console.log(`Successfully parsed ${validQuizData.length} quiz questions.`);
    return res.json({ platform: validQuizData });

  } catch (err) {
    console.error("Error while creating platform:", err.message);
    if (err.response?.data) {
      console.error("Groq API error:", err.response.data);
    }

    console.warn("Using fallback quiz questions.");
    return res.json({ platform: fallbackQuestions });
  }
});


// POST /api/platform/save
router.post('/save', auth, async (req, res) => {
  const userId = req.user?.id;
  const { title, questions } = req.body;

  console.log('Saving quiz for user:', userId);

  try {
    // Validate inputs
    if (!title || !questions) {
      return res.status(400).json({ message: 'Title and questions are required' });
    }

    // Insert quiz into saved_quizzes table
    const result = await db.query(
      'INSERT INTO saved_quizzes (user_id, title, questions, saved_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [userId, title, JSON.stringify(questions)]
    );

    res.status(201).json({
      message: 'Quiz saved successfully',
      savedQuiz: result.rows[0]
    });

  } catch (error) {
    console.error('Error saving quiz:', error);
    res.status(500).json({ message: 'Failed to save quiz' });
  }
});

router.get('/save', auth, async (req, res) => {
  const userId = req.user?.id; // Ensure it's a number

  if (!userId) {
    return res.status(400).json({ error: 'Missing or invalid userId' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM saved_quizzes WHERE user_id = $1 ORDER BY saved_at DESC',
      [userId]
    );

    console.log("Fetched quizzes:", result.rows);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching saved quizzes:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
