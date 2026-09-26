import SupportReferrals from "../../components/support/SupportReferrals.jsx";

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Support &amp; Referrals</h1>
        <p className="text-muted mt-1">
          Official helplines and what Sahaay does with your case.
        </p>
      </div>

      <SupportReferrals />

      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-3 text-sm text-gray-700">
        <h2 className="font-semibold text-ink">How support reaches you</h2>
        <ol className="list-decimal list-inside space-y-1.5">
          <li>You share what happened in your own words, by typing or speaking.</li>
          <li>Sahaay prepares an urgency assessment with quoted evidence.</li>
          <li>A human support officer reviews your case in the NHAA Support Command Center.</li>
          <li>The officer connects you with counselling, legal aid, medical, shelter, or protection review — always through human contact.</li>
        </ol>
        <p className="text-muted">
          Sahaay never calls, messages, or files anything on your behalf
          automatically. Any contact with police, hospitals, counsellors, or
          helplines is made by a human, or by you directly using the numbers above.
        </p>
      </div>
    </div>
  );
}
