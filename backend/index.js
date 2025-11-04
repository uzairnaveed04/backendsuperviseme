// Import dependencies
const express = require('express');
const cors = require('cors');

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
module.exports = app;
