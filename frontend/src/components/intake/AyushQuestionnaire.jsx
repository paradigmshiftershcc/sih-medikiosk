import { useState } from 'react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { Leaf, Loader2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

const SECTIONS = [
  {
    id: 'dashavidha',
    title: 'Dashavidha Pariksha (Ten-fold Examination)',
    description:
      'These questions help the Vaidya understand your constitution (Prakriti), current imbalance (Vikriti), and body strength.',
    questions: [
      {
        id: 'prakriti',
        title: 'Prakriti (Body Nature)',
        description: 'Which best describes your general body constitution?',
        options: ['Mostly dry/light (Vata)', 'Mostly hot/sharp (Pitta)', 'Mostly heavy/calm (Kapha)', 'Mixed / Not sure'],
      },
      {
        id: 'vikriti',
        title: 'Vikriti (Current Imbalance)',
        description: 'How does this current problem make you feel?',
        options: ['Pain, dryness or restlessness (Vata)', 'Burning, heat or inflammation (Pitta)', 'Heaviness, stiffness or swelling (Kapha)', 'Not sure'],
      },
      {
        id: 'agni',
        title: 'Agni (Digestive Fire)',
        description: 'How is your digestion usually?',
        options: ['Irregular / Variable (Vishamagni)', 'Very strong / Fast (Tikshnagni)', 'Slow / Sluggish (Mandagni)', 'Regular / Balanced (Samagni)'],
      },
      {
        id: 'abhyavaharana',
        title: 'Ahara Shakti — Appetite (Abhyavaharana)',
        description: 'How strong is your appetite for food?',
        options: ['Strong', 'Normal', 'Irregular / Often low', 'Very low'],
      },
      {
        id: 'jarana',
        title: 'Ahara Shakti — Digestion (Jarana Shakti)',
        description: 'After a meal, how do you usually feel?',
        options: ['Light and fine quickly', 'Normal', 'Heavy, slow or gaseous', 'Acidity / burning after meals'],
      },
      {
        id: 'koshtha',
        title: 'Koshtha (Bowel Nature)',
        description: 'How are your bowel movements typically?',
        options: ['Hard / Constipated (Krura)', 'Loose / Soft (Mridu)', 'Regular / Normal (Madhya)'],
      },
      {
        id: 'samhanana',
        title: 'Samhanana (Body Frame)',
        description: 'How would you describe your body frame?',
        options: ['Lean / Thin', 'Average / Medium', 'Heavy / Stout'],
      },
      {
        id: 'satmya',
        title: 'Satmya (Tolerance)',
        description: 'What does your body tolerate better?',
        options: ['Cold bothers me more', 'Heat bothers me more', 'Both bother me', 'Neither bothers me'],
      },
      {
        id: 'sattva',
        title: 'Sattva (Mental Strength)',
        description: 'How do you handle stress or worry?',
        options: ['Calm and steady', 'Moderate', 'Anxious / easily disturbed'],
      },
      {
        id: 'sara',
        title: 'Sara (Vitality & Strength)',
        description: 'How is your overall energy and stamina?',
        options: ['Good glow and energy', 'Average', 'Low energy / dull'],
      },
      {
        id: 'vyayamaShakti',
        title: 'Vyayama Shakti (Physical Endurance)',
        description: 'How easily do you get tired with activity (e.g. climbing stairs)?',
        options: ['Good endurance', 'Moderate', 'Tire quickly'],
      },
      {
        id: 'vaya',
        title: 'Vaya (Life Stage)',
        description: 'Which age stage applies to you?',
        options: ['Up to 16 (Balya)', '16 – 60 (Madhyama)', 'Above 60 (Vriddha)'],
      },
    ],
  },
  {
    id: 'ashtavidha',
    title: 'Ashtavidha Pariksha (Examination Cues)',
    description: 'A few quick observations the Vaidya will confirm during the consultation.',
    questions: [
      {
        id: 'jihva',
        title: 'Jihva / Tongue',
        description: 'Is your tongue usually clean or coated?',
        options: ['Clean / Pink', 'Coated (whitish/yellow)', 'Cracked / Dry', 'Not sure'],
      },
      {
        id: 'nidra',
        title: 'Nidra / Sleep',
        description: 'How is your sleep usually?',
        options: ['Sound and refreshing', 'Disturbed / light', 'Too little', 'Too much'],
      },
      {
        id: 'mutraMala',
        title: 'Mutra–Mala (Urine & Stools)',
        description: 'Any difficulty or irregularity in urination or stools?',
        options: ['Normal', 'Constipation often', 'Loose stools often', 'Burning urine'],
      },
    ],
  },
  {
    id: 'nidana',
    title: 'Nidana (Causative Factors)',
    description:
      'Tell us about your daily habits so the Vaidya can identify lifestyle triggers.',
    questions: [
      {
        id: 'aharaHetu',
        title: 'Dietary Habits (Ahara Hetu)',
        description: 'Which of these food habits apply to you?',
        options: ['Late-night meals', 'Excess cold / chilled food & drinks', 'Heavy, oily or spicy food', 'Irregular meal times', 'None of these'],
      },
      {
        id: 'viharaHetu',
        title: 'Lifestyle Habits (Vihara Hetu)',
        description: 'Which of these daily habits apply to you?',
        options: ['Daytime sleep (Divasvapna)', 'Staying up very late', 'Suppressing urine/stool urges', 'Very little physical activity', 'None of these'],
      },
      {
        id: 'manasikaHetu',
        title: 'Mental Factors (Manasika Hetu)',
        description: 'Which mental factor troubles you most?',
        options: ['Chronic stress / work load', 'Worry or anxiety', 'Sorrow or grief', 'None of these'],
      },
    ],
  },
];

// Flatten questions per section for iteration
const ALL_QUESTIONS = SECTIONS.flatMap((s) => s.questions);

const buildPayload = (answers) => ({
  prakriti: answers.prakriti || '',
  vikriti: answers.vikriti || '',
  agni: answers.agni || '',
  koshtha: answers.koshtha || '',
  samhanana: answers.samhanana || '',
  satmya: answers.satmya || '',
  sattva: answers.sattva || '',
  sara: answers.sara || '',
  vyayamaShakti: answers.vyayamaShakti || '',
  vaya: answers.vaya || '',
  aharaShakti: {
    abhyavaharanaShakti: answers.abhyavaharana || '',
    jaranaShakti: answers.jarana || '',
  },
  ashtavidha: {
    jihva: answers.jihva || '',
    nidra: answers.nidra || '',
    mutraMala: answers.mutraMala || '',
  },
  nidana: {
    aharaHetu: answers.aharaHetu || '',
    viharaHetu: answers.viharaHetu || '',
    manasikaHetu: answers.manasikaHetu || '',
  },
});

export default function AyushQuestionnaire({ caseId, onComplete }) {
  const [answers, setAnswers] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSelect = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const payload = buildPayload(answers);
      await api.put(`/intake/ayush/${caseId}`, { ayushData: payload });
      onComplete(); // Advance to patient review
    } catch (err) {
      console.error('Error saving AYUSH data:', err);
      setError('Failed to save profiling data. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isComplete = ALL_QUESTIONS.every((q) => !!answers[q.id]);

  return (
    <Card className="space-y-8 animate-in fade-in duration-300">
      <div className="border-b border-gray-100 pb-6 flex items-start gap-4">
        <div className="bg-green-100 p-3 rounded-full text-green-700 flex-shrink-0">
          <Leaf className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">
            Dashavidha Pariksha
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Ayurvedic profiling — a ten-fold assessment of your constitution,
            digestion, and lifestyle to personalize your care.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {SECTIONS.map((section, sectionIdx) => (
        <section key={section.id} className="space-y-6">
          <div className="flex items-center gap-3 pt-2">
            <span className="bg-green-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
              {sectionIdx + 1}
            </span>
            <div>
              <h3 className="font-bold text-gray-800">{section.title}</h3>
              <p className="text-gray-500 text-sm">{section.description}</p>
            </div>
          </div>

          <div className="space-y-6">
            {section.questions.map((q) => (
              <div key={q.id} className="space-y-3">
                <div>
                  <h4 className="font-semibold text-gray-800">{q.title}</h4>
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
        </section>
      ))}

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
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Saving...
            </>
          ) : (
            'Save Profiling & Review'
          )}
        </Button>
      </div>
    </Card>
  );
}