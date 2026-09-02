import express from 'express';
import { getCaseSummary } from '../controllers/summaryController.js';
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

// Route to fetch (and generate if missing) the case summary
router.get('/:caseId', protect, getCaseSummary);

export default router;