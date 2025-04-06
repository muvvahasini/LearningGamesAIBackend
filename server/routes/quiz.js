const express = require('express');
const Groq = require('groq-sdk');
const router = express.Router();
const auth = require('../middleware/auth');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Middleware to log requests
router.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Generate quiz topics and questions based on grade and course
router.post('/generate-topics', auth, async (req, res) => {
  console.log('Request received:', req.body);
  const { grade, course, selectedTopic } = req.body;

  try {
    if (!grade || !course) {
      console.log('Missing parameters');
      return res.status(400).json({ error: 'Grade and course are required' });
    }

    // Step 1: Generate topics if no selectedTopic is provided
    if (!selectedTopic) {
      console.log('Generating topics for:', { grade, course });
      const topicPrompt = `Suggest 15 interesting and relevant ${course} topics for grade ${grade} students. Return as a JSON array like ["topic1", "topic2", ...].`;
      const topicCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a helpful assistant that returns clean JSON arrays only.' },
          { role: 'user', content: topicPrompt },
        ],
        model: 'llama3-70b-8192',
        max_tokens: 500,
        temperature: 0.2,
      });

      const rawTopics = topicCompletion.choices[0].message.content;
      console.log('Groq response for topics:', rawTopics);
      const topics = JSON.parse(rawTopics.trim());

      if (!Array.isArray(topics) || topics.length === 0) {
        throw new Error('Invalid topics format from AI');
      }

      console.log('Generated topics:', topics);
      return res.json({ topics }); // Return topics to frontend for selection
    }

    // Step 2: If selectedTopic is provided, generate quiz questions
    console.log('Generating questions for topic:', { grade, course, selectedTopic });
    const questionPrompt = `Generate 15 multiple-choice quiz questions for grade ${grade} students on the ${course} topic "${selectedTopic}". Each question should have 4 options (A, B, C, D) with one correct answer. Return the questions as a JSON array of objects, where each object has the structure: {"question": "question text", "options": ["optionA", "optionB", "optionC", "optionD"], "correctAnswer": "correct option letter (e.g., 'A', 'B', 'C', or 'D')"}.`;
    const questionCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful assistant that returns clean JSON arrays only.' },
        { role: 'user', content: questionPrompt },
      ],
      model: 'llama3-70b-8192',
      max_tokens: 1000,
      temperature: 0.2,
    });

    const rawQuestions = questionCompletion.choices[0].message.content;
    console.log('Groq response for questions:', rawQuestions);
    let questions = JSON.parse(rawQuestions.trim());

    // Validate and trim questions to ensure exactly 15
    if (!Array.isArray(questions)) {
      throw new Error('Invalid questions format from AI');
    }

    // Trim to 15 questions if more are returned
    questions = questions.slice(0, 15);

    // Validate each question
    for (const q of questions) {
      if (!q.question || !q.options || !q.correctAnswer) {
        throw new Error('Invalid question format: missing required fields');
      }
      if (q.options.length !== 4) {
        throw new Error('Each question must have exactly 4 options');
      }
      if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer.toUpperCase())) {
        throw new Error('Correct answer must be A, B, C, or D');
      }
    }

    if (questions.length !== 15) {
      throw new Error('Expected exactly 15 questions, got ' + questions.length);
    }

    console.log('Generated questions:', questions);
    return res.json({ questions, selectedTopic }); // Return questions to frontend

  } catch (error) {
    console.error('Error in /generate-topics:', error.message);
    const fallbackTopics = [
      'Topic 1', 'Topic 2', 'Topic 3', 'Topic 4', 'Topic 5',
      'Topic 6', 'Topic 7', 'Topic 8', 'Topic 9', 'Topic 10',
      'Topic 11', 'Topic 12', 'Topic 13', 'Topic 14', 'Topic 15'
    ];
    const fallbackQuestions = Array.from({ length: 15 }, (_, i) => ({
      question: `Sample Question ${i + 1}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'A'
    }));
    return res.json({ topics: fallbackTopics, questions: fallbackQuestions });
  }
});

// Submit quiz answers, calculate score, and save to database (unchanged)
router.post('/submit', auth, async (req, res) => {
  console.log('Submission received:', req.body);
  const { answers, correctAnswers, topic, course } = req.body;
  const userId = req.user.id;

  // Input validation
  if (!Array.isArray(answers) || !Array.isArray(correctAnswers)) {
    console.log('Invalid input: answers or correctAnswers not arrays');
    return res.status(400).json({ error: 'Answers and correctAnswers must be arrays' });
  }

  if (answers.length !== correctAnswers.length) {
    console.log('Invalid input: answers and correctAnswers length mismatch');
    return res.status(400).json({ error: 'Answers and correctAnswers must have the same length' });
  }

  if (!topic || !course) {
    console.log('Invalid input: topic or course missing');
    return res.status(400).json({ error: 'Topic and course are required' });
  }

  try {
    // Calculate score
    let score = 0;
    correctAnswers.forEach((correct, index) => {
      if (answers[index] === correct) score += 1;
    });

    console.log('Calculated score:', score);
    const totalQuestions = answers.length;
    const completionMessage = `Quiz completed! You scored ${score} out of ${totalQuestions}. Great job! Ready for another challenge?`;

    // Save to database
    const db = req.app.get('db');
    if (!db) {
      console.error('Database not initialized');
      return res.status(500).json({ error: 'Database not initialized' });
    }

    await db.query(
      'INSERT INTO quiz_attempts (user_id, topic, course, score, attempted_at) VALUES ($1, $2, $3, $4, NOW())',
      [userId, topic, course, score]
    );
    console.log('Quiz attempt saved: userId:', userId, 'topic:', topic, 'course:', course, 'score:', score);

    // Optionally update user score (cumulative)
    await db.query(
      'UPDATE users SET score = score + $1 WHERE id = $2',
      [score, userId]
    );
    console.log('User score updated for userId:', userId);

    return res.json({ score, completionMessage });
  } catch (error) {
    console.error('Error in /submit:', error.message);
    return res.status(500).json({ error: 'Failed to process submission' });
  }
});

module.exports = router;