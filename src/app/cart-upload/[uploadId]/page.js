'use client';
import { useParams } from 'next/navigation';
import { useState, useRef } from 'react';
import { uploadPendingFile } from '@/lib/uploadPendingFile';

const ID_RE = /^[a-zA-Z0-9-]{20,64}$/;

export default function CartUploadPage() {
  const { uploadId } = useParams();
  const [status, setStatus] = useState('idle'); // idle | uploading | err
  const [msg, setMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploaded, setUploaded] = useState([]);
  const inputRef = useRef(null);

  async function uploadFiles(files) {
    if (!files.length) return;
    setStatus('uploading');
    setMsg('');
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadPendingFile(files[i], uploadId, (pct) => {
          setProgress((i + pct) / files.length);
        });
        setUploaded((prev) => [...prev, files[i].name]);
      }
      setStatus('idle');
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

  if (!ID_RE.test(String(uploadId || ''))) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center">
        <a href="https://joydisplays.com" target="_blank" rel="noopener noreferrer">
          <img src="/logo.png" alt="Joy Displays" className="h-14 mb-8" />
        </a>
        <h1 className="font-display font-bold uppercase text-2xl text-ink mb-2">Link Not Valid</h1>
        <p className="text-ink-light max-w-sm">This upload link isn't valid. Please go back to your cart and try again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="h-6 bg-brand-green" />
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8">
            <a href="https://joydisplays.com" target="_blank" rel="noopener noreferrer">
              <img src="/logo.png" alt="Joy Displays" className="h-14" />
            </a>
          </div>

          <h1 className="font-display font-bold uppercase text-2xl text-ink text-center mb-1">
            Upload your graphics
          </h1>
          <p className="text-ink-light text-center text-sm mb-8">
            Add your files now and keep shopping. They'll be attached to your order when you check out.
          </p>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => status !== 'uploading' && inputRef.current?.click()}
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
              onChange={(e) => {
                uploadFiles(Array.from(e.target.files || []));
                e.target.value = '';
              }}
            />
            {status === 'uploading' ? (
              <p className="text-ink-light">Uploading… {Math.round(progress * 100)}%</p>
            ) : (
              <>
                <p className="text-ink font-medium mb-1">Drop your files here, or click to browse</p>
                <p className="text-ink-light text-sm">PNG, JPG, PDF, PSD, OR Ai</p>
              </>
            )}
          </div>

          {status === 'err' && <p className="text-error text-sm text-center mt-4">{msg}</p>}

          {uploaded.length > 0 && (
            <div className="mt-6 rounded-2xl border border-line bg-paper-soft px-5 py-4">
              <p className="font-semibold text-ink text-sm mb-2">Added to your cart</p>
              <ul className="text-sm text-ink-light space-y-1">
                {uploaded.map((name, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-brand-green">✓</span>
                    <span className="break-all">{name}</span>
                  </li>
                ))}
              </ul>
              <p className="text-ink-light text-xs mt-3">
                You can close this tab and return to your cart.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}