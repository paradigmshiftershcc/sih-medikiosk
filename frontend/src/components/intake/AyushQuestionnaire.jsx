import { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Leaf, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const QUESTIONS = [
  {
    id: 'prakriti',
    title: 'Body Nature (Prakriti)',
    description: 'Which best describes your general body constitution?',
    options: ['Mostly dry/light (Vata)', 'Mostly hot/sharp (Pitta)', 'Mostly heavy/calm (Kapha)', 'Mixed / Not sure']
  },
  {
    id: 'agni',
    title: 'Digestion (Agni)',
    description: 'How is your digestion usually?',
    options: ['Irregular / Variable', 'Very strong / Fast', 'Slow / Sluggish', 'Regular / Normal']
  },
  {
    id: 'koshtha',
    title: 'Bowel Movements (Koshtha)',
    description: 'How are your bowel movements typically?',
    options: ['Hard / Constipated', 'Loose / Soft', 'Regular / Normal']
  },
  {
    id: 'ahara',
    title: 'Diet (Ahara)',
    description: 'What is your primary diet?',
    options: ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Mixed']
  },
  {
    id: 'vihara',
    title: 'Lifestyle (Vihara)',
    description: 'How active is your daily routine?',
    options: ['Sedentary (mostly sitting)', 'Moderately Active', 'Highly Active']
  }
];

export default function AyushQuestionnaire({ caseId, onComplete }) {
  const [answers, setAnswers] = useState({
    prakriti: '', agni: '', koshtha: '', ahara: '', vihara: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSelect = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      await api.put(`/intake/ayush/${caseId}`, { ayushData: answers });
      onComplete(); // Advance to next phase
    } catch (err) {
      console.error("Error saving AYUSH data:", err);
      setError("Failed to save profiling data. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if all questions are answered for validation
  const isComplete = Object.values(answers).every(val => val !== '');

  return (
    <Card className="space-y-8 animate-in fade-in duration-300">
      
      <div className="border-b border-gray-100 pb-6 flex items-start gap-4">
        <div className="bg-green-100 p-3 rounded-full text-green-700 flex-shrink-0">
          <Leaf className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">Ayurvedic Profiling</h2>
          <p className="text-gray-500 text-sm mt-1">
            Answer a few quick questions about your body and habits to help the doctor understand your constitution (Prakriti).
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-8">
        {QUESTIONS.map((q) => (
          <div key={q.id} className="space-y-3">
            <div>
              <h3 className="font-semibold text-gray-800">{q.title}</h3>
              <p className="text-gray-500 text-sm">{q.description}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleSelect(q.id, opt)}
                  className={`p-3 text-left border rounded-xl transition-all ${
                    answers[q.id] === opt 
                      ? 'bg-green-50 border-green-500 text-green-800 shadow-sm font-medium' 
                      : 'bg-white border-gray-200 text-gray-600 hover:border-green-200 hover:bg-gray-50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-6 flex gap-3 border-t border-gray-100">
        <Button 
          variant="outline" 
          className="w-1/3" 
          onClick={onComplete}
          disabled={isSubmitting}
        >
          Skip
        </Button>
        <Button 
          className="w-2/3 bg-green-600 hover:bg-green-700 disabled:bg-green-300" 
          onClick={handleSubmit}
          disabled={!isComplete || isSubmitting}
        >
          {isSubmitting ? (
            <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Saving...</>
          ) : (
            'Complete Case File'
          )}
        </Button>
      </div>
      
    </Card>
  );
}