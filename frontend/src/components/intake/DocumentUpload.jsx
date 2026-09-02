import { useState, useRef } from "react";
import {
  Upload,
  Camera,
  X,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle,
} from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import api from "../../services/api";

export default function DocumentUpload({ caseId, onComplete }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  const [extractedData, setExtractedData] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // MAX 5MB for MVP API limits
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  const handleFileChange = (e) => {
    setError("");
    const selectedFile = e.target.files[0];

    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG).");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError("File is too large. Please select an image under 5MB.");
      return;
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setExtractedData(null);
  };

  const clearSelection = () => {
    setFile(null);
    setPreviewUrl(null);
    setError("");
    setExtractedData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const processDocument = async () => {
    if (!file || !caseId) return;

    setIsProcessing(true);
    setError("");

    try {
      // Convert file to Base64
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = async () => {
        try {
          const base64Data = reader.result;

          // Strict 20-second timeout. Multimodal models take time, but should never hang forever.
          const response = await api.post(
            "/ocr/process",
            {
              caseId,
              imageBase64: base64Data,
              mimeType: file.type,
            },
            { timeout: 20000 },
          );

          setExtractedData(response.data.extractedData);
        } catch (apiError) {
          console.error("OCR API Error:", apiError);
          setError(
            "We couldn't process this document right now. Please try again or skip this step.",
          );
        } finally {
          setIsProcessing(false); // GUARANTEED EXIT STATE
        }
      };

      reader.onerror = () => {
        setError("Error reading file on device.");
        setIsProcessing(false);
      };
    } catch (err) {
      console.error("Document processing error:", err);
      setError("An unexpected error occurred.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload/Selection Area */}
      {!extractedData && (
        <Card className="flex flex-col items-center justify-center p-8 border-dashed border-2 border-brand-200">
          {!previewUrl ? (
            <div className="text-center space-y-6 w-full max-w-sm mx-auto">
              <div className="bg-brand-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                <FileText className="w-10 h-10 text-brand-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  Do you have old records?
                </h3>
                <p className="text-gray-500 mt-2 text-sm">
                  Upload a photo of your old prescriptions or lab reports to add
                  them to your file.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-start gap-2 text-left">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {/* Camera Input (forces camera on mobile) */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  ref={cameraInputRef}
                  onChange={handleFileChange}
                />
                <Button
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" /> Take Photo
                </Button>

                {/* File/Gallery Input */}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <Upload className="w-5 h-5" /> Upload File
                </Button>
              </div>

              <button
                onClick={onComplete}
                className="text-brand-600 font-medium hover:underline text-sm pt-4"
              >
                Skip this step
              </button>
            </div>
          ) : (
            <div className="w-full max-w-md mx-auto space-y-6 text-center">
              <div className="relative inline-block w-full">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-[50vh] w-full object-contain rounded-xl border border-gray-200"
                />
                <button
                  onClick={clearSelection}
                  disabled={isProcessing}
                  className="absolute -top-3 -right-3 p-2 bg-white rounded-full shadow-md border border-gray-200 text-gray-500 hover:text-red-500 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={processDocument}
                  disabled={isProcessing}
                  size="lg"
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />{" "}
                      Processing...
                    </>
                  ) : (
                    "Read Document"
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Structured Results Display */}
      {extractedData && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-yellow-800">
                AI-Extracted Information
              </p>
              <p className="text-yellow-700 text-sm mt-1">
                This information was read automatically. The doctor will verify
                it against your original document.
              </p>
            </div>
          </div>

          <Card className="space-y-6">
            <div className="border-b border-gray-100 pb-4 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  {extractedData.documentType || "Unknown Document Type"}
                </h3>
                {extractedData.date?.value && (
                  <p className="text-gray-500 text-sm">
                    Date: {extractedData.date.value}
                  </p>
                )}
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>

            {/* Medicines */}
            {extractedData.medicines?.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  Medicines Found
                </h4>
                <div className="space-y-2">
                  {extractedData.medicines.map((med, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 p-3 rounded-lg text-sm border border-gray-100 flex justify-between items-center"
                    >
                      <div>
                        <span className="font-semibold text-gray-800">
                          {med.name || "Unable to read name"}
                        </span>
                        {med.strength && (
                          <span className="text-gray-600 ml-2">
                            {med.strength}
                          </span>
                        )}
                      </div>
                      <div className="text-gray-500 text-right">
                        <div>
                          {med.dosage} {med.frequency && `• ${med.frequency}`}
                        </div>
                        {med.confidence === "low" && (
                          <span className="text-xs text-orange-500 font-medium">
                            Low confidence
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unclear Items */}
            {extractedData.unclearItems?.length > 0 && (
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                <h4 className="font-semibold text-orange-800 text-sm mb-2">
                  Unclear Text Detected
                </h4>
                <ul className="list-disc pl-5 text-sm text-orange-700 space-y-1">
                  {extractedData.unclearItems.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 flex gap-3">
              <Button
                variant="outline"
                className="w-1/3"
                onClick={clearSelection}
              >
                Upload Another
              </Button>
              <Button className="w-2/3" onClick={onComplete}>
                Accept & Continue
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
