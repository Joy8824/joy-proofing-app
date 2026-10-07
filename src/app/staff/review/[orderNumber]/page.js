'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { checkProof } from '@/lib/proofCheck';

const KIND_LABEL = { graphic: 'Customer graphic', overlay: 'Overlay' };

export default function StaffReviewPage() {
  const { orderNumber } = useParams();
  const searchParams = useSearchParams();
  const key = searchParams.get('key') || '';
  const q = `orderNumber=${orderNumber}&key=${encodeURIComponent(key)}`;

  const [order, setOrder] = useState(null);
  const [sets, setSets] = useState({});
  const [qtyInputs, setQtyInputs] = useState({});
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState({});
  const [view, setView] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [doneError, setDoneError] = useState(null);

  useEffect(() => {
    if (!orderNumber) return;
    Promise.all([
      fetch(`/api/order-products?${q}`),
      fetch(`/api/staff-proof-sets?${q}`),
      fetch(`/api/staff-proof-state?${q}`),
    ])
      .then(async ([a, b, c]) => {
        if ([a, b, c].some((r) => r.status === 403)) {
          setForbidden(true);
          return;
        }
        if (!a.ok || !b.ok || !c.ok) throw new Error('Could not load this order.');
        const [orderBody, setsBody, stateBody] = await Promise.all([a.json(), b.json(), c.json()]);
        setOrder(orderBody);
        setSets(setsBody.sets || {});
        const inputs = {};
        for (const [lineId, bySet] of Object.entries(stateBody.quantities || {})) {
          inputs[lineId] = {};
          for (const [n, v] of Object.entries(bySet)) inputs[lineId][n] = String(v);
        }
        setQtyInputs(inputs);
        setDone(Boolean(stateBody.done));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderNumber, q]);

  function parseQuantities(inputs) {
    const out = {};
    for (const [lineId, bySet] of Object.entries(inputs)) {
      out[lineId] = {};
      for (const [n, v] of Object.entries(bySet)) {
        const num = Number(v);
        if (v !== '' && Number.isInteger(num) && num >= 1) out[lineId][n] = num;
      }
    }
    return out;
  }

  async function saveQuantities(inputs) {
    const res = await fetch('/api/staff-proof-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, orderNumber, action: 'save', quantities: parseQuantities(inputs) }),
    });
    if (!res.ok) throw new Error('Could not save quantities.');
    setDone(false);
  }

  function setQty(lineId, setNumber, value) {
    setDone(false);
    setQtyInputs((prev) => ({ ...prev, [lineId]: { ...(prev[lineId] || {}), [setNumber]: value } }));
  }

  function handleBlur() {
    setSaveError(null);
    saveQuantities(qtyInputs).catch((err) => setSaveError(err.message));
  }

  async function handleDone() {
    setSaving(true);
    setDoneError(null);
    try {
      await saveQuantities(qtyInputs);
      const res = await fetch('/api/staff-proof-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, orderNumber, action: 'done' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.problems?.join(' ') || body.error || 'Could not mark done.');
      setDone(true);
    } catch (err) {
      setDoneError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-center mt-20 text-ink-light">Loading review…</p>;

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

  const items = order.items.filter((i) => !i.hardwareOnly);
  const result = checkProof(items, sets, qtyInputs);
  const doneDisabled = !result.ok || saving || done;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="h-6 bg-brand-green" />
      <div className="flex-1 px-6 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center mb-8">
            <img src="/logo.png" alt="Joy Displays" className="h-14" />
          </div>

          <h1 className="font-display font-bold uppercase text-2xl text-ink text-center mb-1">Rep Review</h1>
          <p className="font-semibold text-ink-light text-center mb-2">Order {order.orderName}</p>
          <p className="text-center mb-6">
            <a href={`/staff/proofing/${orderNumber}?key=${encodeURIComponent(key)}`} className="text-sm text-ink-light underline hover:text-ink">
              ← Back to uploads
            </a>
          </p>

          <div className="flex flex-col items-center gap-2 mb-10">
            <button
              onClick={handleDone}
              disabled={doneDisabled}
              className={`font-semibold uppercase rounded-xl px-10 py-3 ${
                doneDisabled ? 'bg-line text-ink-light cursor-not-allowed' : 'bg-brand-green text-white'
              }`}
            >
              {done ? 'Done ✓' : saving ? 'Saving…' : 'Done'}
            </button>
            {done && (
              <p className="text-ink-light text-sm text-center">
                Marked done. A new image or a changed quantity will reopen it.
              </p>
            )}
            {!done && !result.ok && (
              <p className="text-ink-light text-sm text-center">
                Done unlocks when every product's quantities match what was ordered.
              </p>
            )}
            {doneError && <p className="text-error text-sm text-center">{doneError}</p>}
            {saveError && <p className="text-error text-sm text-center">{saveError}</p>}
          </div>

          {items.length === 0 ? (
            <p className="text-ink-light text-center">This order has no products that need a proof.</p>
          ) : (
            <div className="flex flex-col gap-8">
              {items.map((item) => {
                const itemSets = sets[item.id] || [];
                const selSet = itemSets.find((s) => s.set === selected[item.id]) || itemSets[0];
                const showing = view[item.id] || 'graphic';
                const shown = selSet ? selSet[showing] : null;
                const info = result.perItem[item.id];
                const countClass =
                  info.assigned === item.quantity
                    ? 'text-brand-green'
                    : info.assigned > item.quantity
                    ? 'text-error'
                    : 'text-ink-light';

                return (
                  <div key={item.id} className="rounded-2xl border border-line bg-paper-soft px-6 py-6">
                    <h2 className="font-display font-bold text-xl text-ink mb-5">{item.name}</h2>

                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-1 min-w-0">
                        {selSet ? (
                          <>
                            <div className="flex gap-2 mb-3">
                              {['graphic', 'overlay'].map((kind) => (
                                <button
                                  key={kind}
                                  onClick={() => setView((p) => ({ ...p, [item.id]: kind }))}
                                  className={`text-xs font-semibold uppercase rounded-lg px-3 py-1 ${
                                    showing === kind ? 'bg-brand-green text-white' : 'bg-line text-ink-light'
                                  }`}
                                >
                                  {KIND_LABEL[kind]}
                                </button>
                              ))}
                            </div>
                            <div className="bg-white rounded-xl border border-line h-96 flex items-center justify-center">
                              {shown?.url ? (
                                <img src={shown.url} alt={`${KIND_LABEL[showing]}, set ${selSet.set}`} className="max-h-full max-w-full object-contain" />
                              ) : (
                                <p className="text-ink-light text-sm">No {KIND_LABEL[showing].toLowerCase()} uploaded for this set.</p>
                              )}
                            </div>
                            <p className="text-xs text-ink-light mt-2">
                              Set {selSet.set} · {KIND_LABEL[showing]}
                            </p>
                            <div className="flex flex-wrap gap-3 mt-4">
                              {itemSets.map((s) => {
                                const thumb = s.graphic || s.overlay;
                                const active = s.set === selSet.set;
                                return (
                                  <button
                                    key={s.set}
                                    onClick={() => setSelected((p) => ({ ...p, [item.id]: s.set }))}
                                    className={`w-20 text-center ${active ? '' : 'opacity-60 hover:opacity-100'}`}
                                  >
                                    {thumb?.url ? (
                                      <img
                                        src={thumb.url}
                                        alt={`Set ${s.set}`}
                                        className={`w-20 h-20 object-contain bg-white rounded-lg border-2 ${active ? 'border-brand-green' : 'border-line'}`}
                                      />
                                    ) : (
                                      <div className="w-20 h-20 bg-white rounded-lg border-2 border-line" />
                                    )}
                                    <span className="text-xs text-ink-light">Set {s.set}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <p className="text-ink-light text-sm">No proof uploaded for this product yet.</p>
                        )}
                      </div>

                      <div className="w-full md:w-56">
                        <p className={`font-display font-bold text-lg ${countClass}`}>
                          Assigned {info.assigned} / {item.quantity}
                        </p>
                        {itemSets.map((s) => (
                          <label key={s.set} className="flex items-center justify-between gap-3 mt-3 text-sm text-ink">
                            Set {s.set}
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={qtyInputs[item.id]?.[s.set] ?? ''}
                              onChange={(e) => setQty(item.id, s.set, e.target.value)}
                              onBlur={handleBlur}
                              className="w-20 rounded-lg border border-line p-2 text-sm text-ink"
                            />
                          </label>
                        ))}
                        {info.problems.length > 0 && (
                          <ul className="mt-4 text-xs text-ink-light list-disc pl-4">
                            {info.problems.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}