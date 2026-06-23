import express, { Application } from 'express';
import { executeRouter } from './routes/executeRouter';

const app: Application = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/execute', executeRouter);

// Basic health-check route for infrastructure
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', service: 'aventisia-gateway' });
});

export default app;