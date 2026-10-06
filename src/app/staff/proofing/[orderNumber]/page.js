'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function StaffProofingPage() {
  const { orderNumber } = useParams();
  const searchParams = useSearchParams();
  const key = searchParams.get('key');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!orderNumber) return;
    fetch(`/api/order-products?orderNumber=${orderNumber}&key=${encodeURIComponent(key || '')}`)
      .then(async (res) => {
        const body = await res.json();
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        if (!res.ok) throw new Error(body.error || 'Something went wrong.');
        setData(body);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderNumber, key]);

  if (loading) return <p className="text-center mt-20 text-ink-light">Loading products…</p>;

  if (forbidden) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center">
        <img src="/logo.png" alt="Joy Displays" className="h-14 mb-8" />
        <h1 className="font-display font-bold uppercase text-2xl text-ink mb-2">Link Not Valid</h1>
        <p className="text-ink-light max-w-sm">This staff link isn't valid. Please use the link from Monday.</p>
      </div>
    );
  }

  if (error) return <p className="text-center mt-20 text-error">{error}</p>;

  const proofItems = data.items.filter((item) => !item.hardwareOnly);
  const hiddenCount = data.items.length - proofItems.length;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="h-6 bg-brand-green" />
      <div className="flex-1 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-center mb-8">
            <img src="/logo.png" alt="Joy Displays" className="h-14" />
          </div>

          <h1 className="font-display font-bold uppercase text-2xl text-ink text-center mb-1">
            Proofing
          </h1>
          <p className="font-semibold text-ink-light text-center mb-8">Order {data.orderName}</p>

          {proofItems.length === 0 ? (
            <p className="text-ink-light text-center">This order has no products that need a proof.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {proofItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-line bg-paper-soft px-6 py-5">
                  <h2 className="font-display font-bold text-lg text-ink mb-1">{item.name}</h2>
                  <p className="text-ink-light text-sm mb-4">Qty: {item.quantity}</p>
                  <button disabled className="bg-line text-ink-light font-semibold uppercase rounded-xl px-5 py-2 text-sm cursor-not-allowed">
                    Upload proof (next step)
                  </button>
                </div>
              ))}
            </div>
          )}

          {hiddenCount > 0 && (
            <p className="text-ink-light text-sm text-center mt-6">
              {hiddenCount} hardware-only {hiddenCount === 1 ? 'item' : 'items'} not shown.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}