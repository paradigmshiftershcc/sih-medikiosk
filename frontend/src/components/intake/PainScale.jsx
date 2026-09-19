import { useState } from "react";
import { Activity, X } from "lucide-react";
import Button from "../ui/Button";

const REGIONS = [
  "Head",
  "Neck",
  "Chest",
  "Upper back",
  "Lower back",
  "Abdomen",
  "Shoulder",
  "Arm",
  "Hand",
  "Hip",
  "Knee",
  "Leg",
  "Foot",
  "Whole body",
];

const CHARACTERS = [
  "Sharp",
  "Dull",
  "Burning",
  "Aching",
  "Throbbing",
  "Cramping",
  "Stabbing",
];

const severityColor = (n) => {
  if (n <= 3) return "bg-green-500";
  if (n <= 6) return "bg-amber-500";
  if (n <= 8) return "bg-orange-500";
  return "bg-red-600";
};

// Visual pain scale + simple body-region picker. Composes a natural-language
// message and hands it to the chat, so no separate data path is needed.
export default function PainScale({ onSend, onClose }) {
  const [intensity, setIntensity] = useState(5);
  const [region, setRegion] = useState("");
  const [character, setCharacter] = useState("");

  const submit = () => {
    if (!region) return;
    const parts = [`I have pain in my ${region.toLowerCase()}.`];
    parts.push(`The severity is ${intensity} out of 10.`);
    if (character) parts.push(`It feels ${character.toLowerCase()}.`);
    onSend(parts.join(" "));
    onClose?.();
  };

  return (
    <div className="border-t border-brand-100 bg-brand-50/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-brand-800">
          <Activity className="w-5 h-5" />
          <h4 className="font-semibold text-sm">Where does it hurt?</h4>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-white text-gray-400"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Severity */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Pain severity: {intensity}/10
        </p>
        <div className="flex gap-1">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              onClick={() => setIntensity(n)}
              className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all ${
                intensity === n
                  ? `${severityColor(n)} text-white scale-110 shadow`
                  : "bg-white border border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
          <span>No pain</span>
          <span>Worst pain</span>
        </div>
      </div>

      {/* Region */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Body region
        </p>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRegion(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                region === r
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-brand-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Character */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Type of pain (optional)
        </p>
        <div className="flex flex-wrap gap-2">
          {CHARACTERS.map((c) => (
            <button
              key={c}
              onClick={() => setCharacter(character === c ? "" : c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                character === c
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-brand-300"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={submit}
          disabled={!region}
          className="flex items-center gap-2"
        >
          Add to consultation
        </Button>
      </div>
    </div>
  );
}
