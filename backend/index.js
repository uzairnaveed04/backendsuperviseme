// Import dependencies
import express from 'express';
import cors from 'cors';
import server from './Server.js'; // ⚠️ ES Module me .js extension include karna zaroori hai

// Create app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Default route
app.get('/', (req, res) => {
  res.send('Backend is working!');
});

// Run server (for local testing)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

// Export app (for Vercel deployment)
export default app;
