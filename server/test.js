const express = require('express');
const app = express();

app.use(express.json());

app.post('/api/quiz/generate-topics', (req, res) => {
  console.log('Request received:', req.body);
  const { grade, course } = req.body;
  const topics = ['Test Topic 1', 'Test Topic 2', 'Test Topic 3'];
  console.log('Sending response:', topics);
  res.json({ topics });
});

app.listen(5000, () => {
  console.log('Test server running on port 5000');
});