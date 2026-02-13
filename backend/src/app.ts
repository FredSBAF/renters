import express, { Express } from 'express';

const app: Express = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes will be added here
app.get('/', (req, res) => {
  res.json({ message: 'Pouraccord API' });
});

export default app;
