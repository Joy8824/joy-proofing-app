'use client';
import { useParams } from 'next/navigation';
import { useState, useRef } from 'react';

export default function UploadPage() {
  const { orderNumber } = useParams();
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

async function uploadFiles(files) {
  if (!files.length) return;
  setStatus('uploading');
  try {
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('orderNumber', orderNumber);
      formData.append('folderType', 'customer');
      formData.append('notify', 'false');
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }
    }

     await fetch('/api/notify-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, folderType: 'customer' }), // 'finishedphotos' in that page
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

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="h-2 bg-brand-green" />
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <img src="/logo.png" alt="Joy Displays" className="h-14" />
          </div>

          <h1 className="font-display font-bold uppercase text-2xl text-ink text-center mb-1">
            Upload your graphic
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
                multiple
                accept="image/*,application/pdf,.psd,.ai"
                className="hidden"
                onChange={(e) => uploadFiles(Array.from(e.target.files || []))}
              />
              {status === 'uploading' ? (
                <p className="text-ink-light">Uploading…</p>
              ) : (
                <>
                  <p className="text-ink font-medium mb-1">Drop your file here, or click to browse</p>
                  <p className="text-ink-light text-sm">PNG, JPG, PDF, PSD, OR Ai</p>
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