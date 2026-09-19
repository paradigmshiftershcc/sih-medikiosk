import CaseRecord from '../models/CaseRecord.js';
import { processDocumentImage } from '../services/ocrService.js';
import { atomizeObservations } from '../services/observationService.js';

// Allowed document formats fed to Gemini multimodal.
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

// The frontend caps source files at 5MB; Base64 inflates ~1.33x.
const MAX_BASE64_LENGTH = 8 * 1024 * 1024; // ~8MB of base64 text

export const processOcrUpload = async (req, res) => {
  try {
    const { caseId, imageBase64, mimeType } = req.body;

    if (!caseId || !imageBase64) {
      return res
        .status(400)
        .json({ message: 'Missing caseId or image data.' });
    }

    // Server-side validation: never trust the frontend accept attribute alone.
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({
        message: 'Invalid file format. Only JPG, PNG and WEBP images are supported.',
      });
    }

    if (typeof imageBase64 !== 'string') {
      return res.status(400).json({ message: 'Invalid image data.' });
    }

    const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/i, '');
    if (cleanBase64.length === 0 || cleanBase64.length > MAX_BASE64_LENGTH) {
      return res.status(413).json({
        message: 'Image too large. Please upload an image under 5MB.',
      });
    }

    const caseRecord = await CaseRecord.findById(caseId);
    if (!caseRecord) {
      return res.status(404).json({ message: 'Case not found.' });
    }

    // A patient may only attach documents to their own case.
    if (caseRecord.patientId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: 'Unauthorized access to case.' });
    }

    // Pass base64 data to Gemini Multimodal Service
    const extractedData = await processDocumentImage(cleanBase64, mimeType);

    // Save only the extracted structured data, NOT the base64 image (Privacy & DB size)
    caseRecord.ocrData = extractedData;
    await caseRecord.save();

    // Atomize numeric lab values into indexed observations for trends/filters.
    let observationCount = 0;
    try {
      observationCount = await atomizeObservations(caseRecord);
    } catch (atomizeError) {
      // Observation indexing is best-effort; the document itself is saved.
      console.error(
        '[OCR Controller] Observation atomization failed:',
        atomizeError?.message || atomizeError,
      );
    }

    console.log(`[OCR Controller] Document processed for case ${caseId}.`);
    res.status(200).json({
      message: 'Document processed successfully',
      extractedData: caseRecord.ocrData,
      observationsIndexed: observationCount,
    });
  } catch (error) {
    // Never log the base64 image or full payload.
    console.error(
      '[OCR Controller] Document processing failed:',
      error?.message || error,
    );
    res.status(500).json({
      message:
        'Failed to process document. Please ensure the image is clear and try again.',
    });
  }
};