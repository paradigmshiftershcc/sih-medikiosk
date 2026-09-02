import express from 'express';
import { processChatTurn } from '../controllers/intakeController.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Simple inline auth middleware for protected routes
const protect = (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // Attach user ID to request
      next();
    } catch (error) {
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

router.post('/chat', protect, processChatTurn);

export default router;