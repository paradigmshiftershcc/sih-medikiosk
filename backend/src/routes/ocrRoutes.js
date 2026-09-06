import express from 'express';
import { processOcrUpload } from '../controllers/ocrController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Document processing is a patient action; the controller also verifies
// the patient owns the target case.
router.post('/process', protect, processOcrUpload);

export default router;