const dotenv = require('dotenv');
const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const morgan = require('morgan');

// Load .env
dotenv.config();
const envVars = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE', 'JWT_SECRET', 'PORT', 'GROQ_API_KEY', 'FRONTEND_URL'];
envVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`${varName} missing!!`);
    process.exit(1);
  }
});

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Limit each IP to 100 requests per windowMs
}));

app.use(morgan('combined'))

// Load DB

const db = require('./db');

app.set('db', db);

db.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('DB connection test failed:', err.message);
    process.exit(1);
  } else {
    console.log('DB connection test successful!!');
  }
});

// Routes
const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quiz');
const platformRoutes = require('./routes/platform');
const dashboard = require('./routes/dashboard');
const profileRoute = require('./routes/profile');


app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/dashboard',dashboard);
app.use('/api/profile', profileRoute);




// Health Check
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'Server running!', db: 'Connected' });
  } catch (err) {
    res.status(500).json({ status: 'Server running successfully!!', db: 'Disconnected', error: err.message });
  }
});

// Root Route
app.get('/', (req, res) => {
  res.send("Backend working successfully!!  POST The Signup : /api/auth/signup");
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Something went wrong!!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on the port ${PORT}!`));