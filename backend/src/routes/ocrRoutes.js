import express from 'express';
import { processOcrUpload } from '../controllers/ocrController.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Auth Middleware (Reused logic for MVP)
const protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      req.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized' });
  }
};

router.post('/process', protect, processOcrUpload);

export default router;