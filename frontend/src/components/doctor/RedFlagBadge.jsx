import { AlertTriangle } from 'lucide-react';

export default function RedFlagBadge({ flags }) {
  if (!flags || flags.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
      <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
      <div>
        <h3 className="font-bold text-red-800">Critical Symptoms Detected</h3>
        <ul className="mt-1 list-disc pl-5 text-red-700 text-sm font-medium space-y-0.5">
          {flags.map((flag, idx) => (
            <li key={idx}>{flag}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}