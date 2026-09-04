import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const modelsToTest = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash-lite',
];

const TIMEOUT_MS = 15_000;

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Request timed out after ${timeoutMs / 1000} seconds`)),
        timeoutMs
      )
    ),
  ]);
}

async function runTest() {
  console.log('--- Starting Standalone Gemini API Test ---');

  if (!process.env.GEMINI_API_KEY) {
    console.error('FATAL: GEMINI_API_KEY is not set in .env');
    return;
  }

  for (const model of modelsToTest) {
    console.log(`\nTesting model: ${model}`);
    const startTime = Date.now();

    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: 'Reply exactly with OK',
        }),
        TIMEOUT_MS
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`[SUCCESS] ${model}: ${response.text}`);
      console.log(`Time: ${elapsed}s`);
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      console.log(`[FAILED] ${model}`);
      console.log(`Time: ${elapsed}s`);
      console.log(`Status: ${error.status || 'No status'}`);
      console.log(`Message: ${error.message}`);

      if (error.message?.includes('timed out')) {
        console.log(`[TIMEOUT] ${model} exceeded the 15-second limit`);
      }
    }
  }

  console.log('\n--- Test Complete ---');
}

runTest();