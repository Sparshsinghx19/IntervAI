import express from 'express';
import cors from 'cors';

const app = express();
// Explicitly use a development port (4000) for the API
const port = 4000;

// Enable CORS so the Next.js frontend (on port 3000) can request data
app.use(cors({ origin: 'http://localhost:3000' }));

// A simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Express API is running on http://localhost:${port}`);
});
