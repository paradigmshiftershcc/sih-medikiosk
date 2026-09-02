import CaseRecord from '../models/CaseRecord.js';
import { processDocumentImage } from '../services/ocrService.js';

export const processOcrUpload = async (req, res) => {
  try {
    const { caseId, imageBase64, mimeType } = req.body;

    if (!caseId || !imageBase64) {
      return res.status(400).json({ message: 'Missing caseId or image data.' });
    }

    // Validate mimeType to prevent non-image uploads
    if (!mimeType || !mimeType.startsWith('image/')) {
      return res.status(400).json({ message: 'Invalid file format. Only images are supported.' });
    }

    console.log(`[OCR Controller] Processing image for case ${caseId}`);

    const caseRecord = await CaseRecord.findById(caseId);
    if (!caseRecord) {
      return res.status(404).json({ message: 'Case not found.' });
    }

    // Pass base64 data to Gemini Multimodal Service
    const extractedData = await processDocumentImage(imageBase64, mimeType);

    // Save only the extracted structured data, NOT the base64 image (Privacy & DB size)
    caseRecord.ocrData = extractedData;
    await caseRecord.save();

    console.log(`[OCR Controller] Data extracted and saved successfully.`);
    res.status(200).json({
      message: 'Document processed successfully',
      extractedData: caseRecord.ocrData
    });

  } catch (error) {
    console.error("[OCR Controller] Error:", error.message || error);
    res.status(500).json({ 
      message: 'Failed to process document. Please ensure the image is clear and try again.' 
    });
  }
};