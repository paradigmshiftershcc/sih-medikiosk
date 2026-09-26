export default function EmptyState({ title, body, action }) {
  return (
    <div className="bg-white border border-gray-100 p-8 sm:p-10 rounded-2xl text-center shadow-sm">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-50 flex items-center justify-center mb-3">
        <span className="text-2xl text-brand-300">○</span>
      </div>
      <h3 className="font-semibold text-ink">{title}</h3>
      {body && <p className="text-sm text-muted mt-1 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
