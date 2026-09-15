'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ReviewPage() {
  const { orderNumber } = useParams();
  const [proof, setProof] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [decisionMade, setDecisionMade] = useState(null);

  useEffect(() => {
    fetch(`/api/proof-file?orderNumber=${orderNumber}`)
      .then((res) => {
        if (!res.ok) throw new Error('No proof found for this order yet.');
        return res.json();
      })
      .then(setProof)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderNumber]);

  async function submitDecision(decision) {
    setSubmitting(true);
    try {
      await fetch('/api/review-decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, decision, comment }),
      });
      setDecisionMade(decision);
    } catch {
      setError('Something went wrong submitting your decision. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="text-center mt-20 text-ink-light">Loading proof…</p>;
  if (error) return <p className="text-center mt-20 text-error">{error}</p>;

  if (decisionMade) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 mb-4 rounded-full bg-brand-green flex items-center justify-center text-white text-xl">✓</div>
        <h1 className="font-display font-bold uppercase text-2xl text-ink mb-2">
          {decisionMade === 'approved' ? 'Proof Approved' : 'Proof Rejected'}
        </h1>
        <p className="text-ink-light">
          {decisionMade === 'approved'
            ? "Thanks! We'll get your order into production."
            : "We've received your feedback and will follow up on next steps."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="h-2 bg-brand-green" />
      <div className="flex-1 flex flex-col md:flex-row px-6 py-8 gap-6 max-w-6xl mx-auto w-full">
        <div className="flex-1 flex flex-col">
          <h1 className="font-display font-bold uppercase text-xl text-ink mb-4">
            Review Your Proof — Order #{orderNumber}
          </h1>
          <iframe src={proof.embedUrl} title="Proof" className="w-full flex-1 min-h-[70vh] rounded-2xl border border-line" />
        </div>
        <div className="w-full md:w-72 flex flex-col gap-4">
          <div>
            <label className="font-semibold text-ink text-sm mb-2 block">Notes (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={8}
              placeholder="Add any comments here…"
              className="w-full rounded-xl border border-line p-3 text-sm text-ink"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={() => submitDecision('approved')} disabled={submitting}
              className="flex-1 bg-brand-green text-white font-semibold uppercase rounded-xl py-3">
              Approve
            </button>
            <button onClick={() => submitDecision('rejected')} disabled={submitting}
              className="flex-1 bg-error text-white font-semibold uppercase rounded-xl py-3">
              Reject
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}