'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { uploadFileInChunks } from '@/lib/uploadFile';

export default function FinishedPhotosPage() {
  const { orderNumber } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [linkValid, setLinkValid] = useState(null);
  const inputRef = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!orderNumber) return;
    fetch(`/api/verify-token?orderNumber=${orderNumber}&token=${token || ''}`)
      .then((res) => res.json())
      .then((data) => setLinkValid(data.valid))
      .catch(() => setLinkValid(false));
  }, [orderNumber, token]);

  async function uploadFiles(files) {
  if (!files.length) return;
  setStatus('uploading');
  setProgress(0);
  const fileProgress = new Array(files.length).fill(0);

  try {
    await Promise.all(files.map((file, i) =>
      uploadFileInChunks(file, orderNumber, 'finishedproof', token, (pct) => {
        fileProgress[i] = pct;
        setProgress(fileProgress.reduce((a, b) => a + b, 0) / files.length);
      })
    ));

    await fetch('/api/notify-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, folderType: 'finishedproof' }),
    });

    setStatus('ok');
  } catch (err) {
    setStatus('err');
    setMsg(err.message || 'Something went wrong. Try again.');
  }
}

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    uploadFiles(Array.from(e.dataTransfer.files || []));
  }

  if (linkValid === null) {
    return <p className="text-center mt-20 text-ink-light">Checking link…</p>;
  }

  if (linkValid === false) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center">
        <img src="/logo.png" alt="Joy Displays" className="h-14 mb-8" />
        <h1 className="font-display font-bold uppercase text-2xl text-ink mb-2">Link Not Valid</h1>
        <p className="text-ink-light max-w-sm">This upload link has expired or isn't valid. Please contact us for a new one.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="h-2 bg-brand-green" />
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <img src="/logo.png" alt="Joy Displays" className="h-14" />
          </div>

          <h1 className="font-display font-bold uppercase text-2xl text-ink text-center mb-1">
            Upload Finished Photos
          </h1>
          <p className="font-semibold text-ink-light text-center mb-8">Order #{orderNumber}</p>

          {status === 'ok' ? (
            <div className="rounded-2xl border border-line bg-paper-soft px-6 py-10 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-brand-green flex items-center justify-center text-white text-xl">
                ✓
              </div>
              <p className="font-display font-bold uppercase text-lg text-ink mb-1">Got it!</p>
              <p className="text-ink-light text-sm">We've received your files — we'll be in touch soon.</p>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed px-6 py-14 text-center cursor-pointer transition-colors ${
                dragActive ? 'border-brand-green bg-paper-soft' : 'border-line'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.psd,.ai"
                className="hidden"
                onChange={(e) => uploadFiles(Array.from(e.target.files || []))}
              />
              {status === 'uploading' ? (
                <p className="text-ink-light">Uploading… {Math.round(progress * 100)}%</p>
              ) : (
                <>
                  <p className="text-ink font-medium mb-1">Drop your file here, or click to browse</p>
                  <p className="text-ink-light text-sm">PNG, JPG, PDF, PSD, or AI</p>
                </>
              )}
            </div>
          )}

          {status === 'err' && <p className="text-error text-sm text-center mt-4">{msg}</p>}
        </div>
      </div>
    </div>
  );
}