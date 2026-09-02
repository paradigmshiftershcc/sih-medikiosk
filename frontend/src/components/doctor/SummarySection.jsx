export default function SummarySection({ title, content, icon: Icon }) {
  if (!content || (Array.isArray(content) && content.length === 0)) return null;

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-50 pb-3 mb-3">
        {Icon && <Icon className="w-5 h-5 text-brand-600" />}
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      
      {Array.isArray(content) ? (
        <ul className="list-disc pl-5 space-y-1.5 text-gray-700">
          {content.map((item, idx) => (
            <li key={idx} className="leading-relaxed">{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{content}</p>
      )}
    </div>
  );
}