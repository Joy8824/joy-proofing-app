'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { resizeImageForProof } from '@/lib/resizeImage';

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export default function StaffProofingPage() {
  const { orderNumber } = useParams();
  const searchParams = useSearchParams();
  const key = searchParams.get('key');

  const [data, setData] = useState(null);
  const [sets, setSets] = useState({});
  const [extraSets, setExtraSets] = useState({});
  const [busySlot, setBusySlot] = useState(null);
  const [slotErrors, setSlotErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forbidden, setForbidden] = useState(false);

  const loadSets = useCallback(async () => {
    const res = await fetch(`/api/staff-proof-sets?orderNumber=${orderNumber}&key=${encodeURIComponent(key || '')}`);
    if (!res.ok) throw new Error('Could not load uploaded proofs.');
    const body = await res.json();
    setSets(body.sets || {});
  }, [orderNumber, key]);

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
        await loadSets();
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderNumber, key, loadSets]);

  function setsFor(item) {
    return sets[item.id] || [];
  }

  function countFor(item) {
    const serverMax = Math.max(0, ...setsFor(item).map((s) => s.set));
    return Math.max(1, serverMax, extraSets[item.id] || 0);
  }

  function slotFor(item, n, kind) {
    const found = setsFor(item).find((s) => s.set === n);
    return found ? found[kind] : null;
  }

  function addSet(item) {
    setExtraSets((prev) => ({ ...prev, [item.id]: countFor(item) + 1 }));
  }

  async function handleUpload(item, n, kind, file) {
    if (!file) return;
    const slotId = `${item.id}-${n}-${kind}`;
    setBusySlot(slotId);
    setSlotErrors((prev) => ({ ...prev, [slotId]: null }));
    try {
      const resized = await resizeImageForProof(file);
      if (resized.size > MAX_UPLOAD_BYTES) {
        throw new Error('That image is still too large after resizing. Please resize it yourself and try again.');
      }
      const formData = new FormData();
      formData.append('file', resized);
      formData.append('key', key || '');
      formData.append('orderNumber', orderNumber);
      formData.append('lineItemId', item.id);
      formData.append('set', String(n));
      formData.append('kind', kind);

      const res = await fetch('/api/staff-proof-upload', { method: 'POST', body: formData });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Upload failed');
      await loadSets();
    } catch (err) {
      setSlotErrors((prev) => ({ ...prev, [slotId]: err.message || 'Upload failed' }));
    } finally {
      setBusySlot(null);
    }
  }

  function renderSlot(item, n, kind, label) {
    const slotId = `${item.id}-${n}-${kind}`;
    const existing = slotFor(item, n, kind);
    const busy = busySlot === slotId;
    return (
      <div key={kind} className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase text-ink-light mb-2">{label}</p>
        {existing?.url && (
          <img
            src={existing.url}
            alt={`${label}, set ${n}`}
            className="w-full h-32 object-contain bg-white rounded-lg border border-line mb-2"
          />
        )}
        <label
          className={`inline-block text-sm font-semibold uppercase rounded-xl px-4 py-2 ${
            busy ? 'bg-line text-ink-light cursor-wait' : 'bg-brand-green text-white cursor-pointer'
          }`}
        >
          {busy ? 'Uploading…' : existing ? 'Replace' : 'Upload'}
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            disabled={busySlot !== null}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              handleUpload(item, n, kind, file);
            }}
          />
        </label>
        {slotErrors[slotId] && <p className="text-error text-xs mt-2">{slotErrors[slotId]}</p>}
      </div>
    );
  }

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

          <h1 className="font-display font-bold uppercase text-2xl text-ink text-center mb-1">Proofing</h1>
          <p className="font-semibold text-ink-light text-center mb-2">Order {data.orderName}</p>
          <p className="text-ink-light text-sm text-center mb-8">
            Upload one PNG or JPG per slot. Images are shrunk to 900px on the longest side before they're saved.
          </p>
          <p className="text-center mb-6">
  <a href={`/staff/review/${orderNumber}?key=${encodeURIComponent(key || '')}`} className="text-sm text-ink-light underline hover:text-ink">
    Go to review →
  </a>
</p>

          {proofItems.length === 0 ? (
            <p className="text-ink-light text-center">This order has no products that need a proof.</p>
          ) : (
            <div className="flex flex-col gap-6">
              {proofItems.map((item) => {
                const count = countFor(item);
                return (
                  <div key={item.id} className="rounded-2xl border border-line bg-paper-soft px-6 py-5">
                    <h2 className="font-display font-bold text-lg text-ink mb-1">{item.name}</h2>
                    <p className="text-ink-light text-sm mb-4">Qty: {item.quantity}</p>

                    <div className="flex flex-col gap-4">
                      {Array.from({ length: count }, (_, i) => i + 1).map((n) => (
                        <div key={n} className="rounded-xl border border-line bg-white p-4">
                          <p className="font-semibold text-ink text-sm mb-3">Set {n}</p>
                          <div className="flex gap-4">
                            {renderSlot(item, n, 'graphic', 'Customer graphic')}
                            {renderSlot(item, n, 'overlay', 'Overlay')}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => addSet(item)}
                      className="mt-4 text-sm text-ink-light underline hover:text-ink"
                    >
                      + Add another set
                    </button>
                  </div>
                );
              })}
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