'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

export default function ProofUploadPage() {
  const { orderNumber } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [linkValid, setLinkValid] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!orderNumber) return;
    fetch(`/api/verify-token?orderNumber=${orderNumber}&token=${token || ''}`)
      .then((res) => res.json())
      .then((data) => setLinkValid(data.valid))
      .catch(() => setLinkValid(false));
  }, [orderNumber, token]);

  async function uploadFile(file) {
    if (!file) return;
    setStatus('uploading');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('orderNumber', orderNumber);
    formData.append('folderType', 'proof');
    formData.append('token', token);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        setStatus('ok');
      } else {
        setStatus('err');
        setMsg(data.error || 'Upload failed. Try again.');
      }
    } catch {
      setStatus('err');
      setMsg('Something went wrong. Try again.');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragActive(false);
    uploadFile(e.dataTransfer.files?.[0]);
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
            Upload your Proof
          </h1>
          <p className="font-semibold text-ink-light text-center mb-8">Order #{orderNumber}</p>

          {status === 'ok' ? (
            <div className="rounded-2xl border border-line bg-paper-soft px-6 py-10 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-brand-green flex items-center justify-center text-white text-xl">
                ✓
              </div>
              <p className="font-display font-bold uppercase text-lg text-ink mb-1">Got it!</p>
              <p className="text-ink-light text-sm">We've received your file — we'll be in touch soon.</p>
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
                accept="image/*,application/pdf,.psd,.ai"
                className="hidden"
                onChange={(e) => uploadFile(e.target.files?.[0])}
              />
              {status === 'uploading' ? (
                <p className="text-ink-light">Uploading…</p>
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