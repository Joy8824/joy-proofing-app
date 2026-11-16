'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { uploadFileInChunks } from '@/lib/uploadFile';

// Per-item upload page: lists the items in the order that need graphics. For
// each upload the customer says how many of that item the graphic covers, the
// file goes into the item's own subfolder of the Customer folder, and the
// quantity is saved so the page can show what is still uncovered.
// Still to come: size checks, and telling Make once every item is covered.

function coveredQuantity(item) {
  return (item.uploads || []).reduce((sum, upload) => sum + (Number(upload.quantity) || 0), 0);
}

export default function UploadItemsPage() {
  const { orderNumber } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState('loading'); // loading | invalid | error | ready
  const [items, setItems] = useState([]);
  // Per item, keyed by item.id: { status, progress, msg }
  const [progress, setProgress] = useState({});
  // The quantity window: { item, file, quantity } while it is open
  const [asking, setAsking] = useState(null);
  const inputRefs = useRef({});

  useEffect(() => {
    if (!orderNumber) return;
    fetch(`/api/order-items?orderNumber=${orderNumber}&token=${token || ''}`)
      .then(async (res) => {
        if (res.status === 403) {
          setState('invalid');
          return;
        }
        if (!res.ok) {
          setState('error');
          return;
        }
        const data = await res.json();
        setItems(data.items || []);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [orderNumber, token]);

  function updateProgress(itemId, changes) {
    setProgress((prev) => ({
      ...prev,
      [itemId]: { status: 'idle', progress: 0, msg: '', ...prev[itemId], ...changes },
    }));
  }

  // A file was picked: always ask how many of the item this graphic is for
  // before uploading.
  function fileChosen(item, file) {
    if (!file) return;
    const remaining = item.quantity - coveredQuantity(item);
    if (remaining < 1) return;
    setAsking({ item, file, quantity: remaining });
  }

  async function uploadForItem(item, file, quantity) {
    updateProgress(item.id, { status: 'uploading', progress: 0, msg: '' });
    try {
      await uploadFileInChunks(
        file,
        orderNumber,
        'customer',
        token,
        (pct) => updateProgress(item.id, { progress: pct }),
        { itemFolder: item.folder }
      );

      const res = await fetch('/api/item-uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          token,
          itemFolder: item.folder,
          fileName: file.name,
          quantity,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save this upload.');

      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, uploads: data.uploads } : it))
      );
      updateProgress(item.id, { status: 'idle' });
    } catch (err) {
      updateProgress(item.id, {
        status: 'err',
        msg: err.message || 'Something went wrong. Try again.',
      });
    }
  }

  if (state === 'loading') {
    return <p className="text-center mt-20 text-ink-light">Checking link…</p>;
  }

  if (state === 'invalid' || state === 'error') {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center">
        <a href="https://joydisplays.com" target="_blank" rel="noopener noreferrer">
          <img src="/logo.png" alt="Joy Displays" className="h-14 mb-8" />
        </a>
        <h1 className="font-display font-bold uppercase text-2xl text-ink mb-2">
          {state === 'invalid' ? 'Link Not Valid' : 'Something Went Wrong'}
        </h1>
        <p className="text-ink-light max-w-sm">
          {state === 'invalid'
            ? "This upload link has expired or isn't valid. Please contact us for a new one."
            : "We couldn't load this order right now. Please try again in a moment."}
        </p>
      </div>
    );
  }

  const askingRemaining = asking ? asking.item.quantity - coveredQuantity(asking.item) : 0;
  const askingValid =
    asking &&
    Number.isInteger(asking.quantity) &&
    asking.quantity >= 1 &&
    asking.quantity <= askingRemaining;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="h-6 bg-brand-green" />
      <div className="flex-1 flex justify-center px-6 py-16">
        <div className="w-full max-w-xl">
          <div className="flex justify-center mb-8">
            <a href="https://joydisplays.com" target="_blank" rel="noopener noreferrer">
              <img src="/logo.png" alt="Joy Displays" className="h-14" />
            </a>
          </div>

          <h1 className="font-display font-bold uppercase text-2xl text-ink text-center mb-1">
            Upload your graphics
          </h1>
          <p className="font-semibold text-ink-light text-center mb-2">Order #{orderNumber}</p>
          <div className="text-center mb-8">
            <a href="https://shopify.com/67977838726/account/orders" className="text-sm text-ink-light underline hover:text-ink">
              ← Back to your orders
            </a>
          </div>

          {items.length === 0 ? (
            <div className="rounded-2xl border border-line bg-paper-soft px-6 py-10 text-center">
              <p className="text-ink-light">No items in this order need graphics.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => {
                const up = progress[item.id] || { status: 'idle', progress: 0, msg: '' };
                const uploading = up.status === 'uploading';
                const covered = coveredQuantity(item);
                const allCovered = covered >= item.quantity;
                const disabled = uploading || allCovered;
                return (
                  <li key={item.id} className="rounded-2xl border border-line bg-paper-soft px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-ink font-medium">{item.name}</p>
                        <p className="text-ink-light text-sm">
                          Graphics received for {covered} of {item.quantity}
                        </p>
                      </div>
                      <input
                        ref={(el) => { inputRefs.current[item.id] = el; }}
                        type="file"
                        accept="image/*,application/pdf,.psd,.ai"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          fileChosen(item, file);
                        }}
                      />
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => inputRefs.current[item.id]?.click()}
                        className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                          disabled
                            ? 'border border-line text-ink-light cursor-not-allowed'
                            : 'bg-brand-green text-white cursor-pointer'
                        }`}
                      >
                        {uploading
                          ? `Uploading… ${Math.round(up.progress * 100)}%`
                          : allCovered
                            ? '✓ Complete'
                            : covered > 0
                              ? 'Upload another'
                              : 'Upload graphic'}
                      </button>
                    </div>

                    {item.uploads?.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {item.uploads.map((upload, i) => (
                          <li key={`${upload.fileName}-${i}`} className="text-sm text-ink-light break-all">
                            ✓ {upload.fileName}
                            {` (for ${upload.quantity})`}
                          </li>
                        ))}
                      </ul>
                    )}

                    {up.status === 'err' && <p className="text-error text-sm mt-3">{up.msg}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {asking && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-6">
          <div className="w-full max-w-sm rounded-2xl bg-paper px-6 py-6">
            <p className="font-display font-bold uppercase text-lg text-ink mb-1">How many is this graphic for?</p>
            <p className="text-ink-light text-sm mb-1">{asking.item.name}</p>
            <p className="text-ink-light text-sm mb-4 break-all">{asking.file.name}</p>

            <label className="block text-sm text-ink mb-1" htmlFor="graphic-quantity">
              Quantity (up to {askingRemaining})
            </label>
            <input
              id="graphic-quantity"
              type="number"
              min={1}
              max={askingRemaining}
              step={1}
              value={Number.isNaN(asking.quantity) ? '' : asking.quantity}
              onChange={(e) => setAsking({ ...asking, quantity: e.target.valueAsNumber })}
              className="w-full rounded-lg border border-line px-3 py-2 text-ink mb-5"
            />

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setAsking(null)}
                className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-light cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!askingValid}
                onClick={() => {
                  const { item, file, quantity } = asking;
                  setAsking(null);
                  uploadForItem(item, file, quantity);
                }}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  askingValid
                    ? 'bg-brand-green text-white cursor-pointer'
                    : 'border border-line text-ink-light cursor-not-allowed'
                }`}
              >
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
