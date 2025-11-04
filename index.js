// backend/index.js
import express from 'express';
import cors from 'cors';
import server from './Server.js'; // ES module import, include file extension

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('Backend is working!');
});

// Agar tum Server.js me routes define kar rahe ho
// app.use('/api', server); // Uncomment if needed

// Server start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

export default app;
