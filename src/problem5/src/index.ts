import express from 'express';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import itemRoutes from './routes/itemRoutes';

dotenv.config();
const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api', userRoutes);
app.use('/api', itemRoutes);

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
