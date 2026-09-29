'use client';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function FinishedGalleryPage() {
  const { orderNumber } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [linkValid, setLinkValid] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!orderNumber) return;
    fetch(`/api/verify-token?orderNumber=${orderNumber}&token=${token || ''}`)
      .then((res) => res.json())
      .then((data) => setLinkValid(data.valid))
      .catch(() => setLinkValid(false));
  }, [orderNumber, token]);

  useEffect(() => {
    if (!linkValid) return;
    fetch(`/api/finished-photos?orderNumber=${orderNumber}&token=${token || ''}`)
      .then((res) => {
        if (!res.ok) throw new Error('No finished photos found for this order yet.');
        return res.json();
      })
      .then((data) => setPhotos(data.photos))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [linkValid, orderNumber, token]);

  if (linkValid === null) {
    return <p className="text-center mt-20 text-ink-light">Checking link…</p>;
  }

  if (linkValid === false) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 text-center">
        <a href="https://joydisplays.com" target="_blank" rel="noopener noreferrer">
          <img src="/logo.png" alt="Joy Displays" className="h-14 mb-8" />
        </a>
        <h1 className="font-display font-bold uppercase text-2xl text-ink mb-2">Link Not Valid</h1>
        <p className="text-ink-light max-w-sm">This link has expired or isn't valid. Please contact us for a new one.</p>
      </div>
    );
  }

  if (loading) return <p className="text-center mt-20 text-ink-light">Loading photos…</p>;
  if (error) return <p className="text-center mt-20 text-error">{error}</p>;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <div className="h-6 bg-brand-green" />
      <div className="flex-1 px-6 py-16">
        <div className="max-w-3xl mx-auto">
          <div className="flex justify-center mb-8">
            <a href="https://joydisplays.com" target="_blank" rel="noopener noreferrer">
              <img src="/logo.png" alt="Joy Displays" className="h-14" />
            </a>
          </div>

          <h1 className="font-display font-bold uppercase text-2xl text-ink text-center mb-1">
            Your Finished Photos
          </h1>
          <p className="font-semibold text-ink-light text-center mb-2">Order #{orderNumber}</p>
          <div className="text-center mb-8">
            <a href="https://joydisplays.com" className="text-sm text-ink-light underline hover:text-ink">
              ← Back to store
            </a>
          </div>

          <p className="text-ink text-center mb-8">
            Your prints turned out great! Below are the test fittings — check them out.
          </p>

          <div className="flex flex-wrap justify-center gap-4 max-w-3xl mx-auto">
            {photos.map((photo) => (
              <a key={photo.name} href={photo.url} target="_blank" rel="noopener noreferrer" className="w-40">
                <img
                src={photo.url}
                alt={photo.name}
                className="w-40 h-40 object-cover rounded-xl border border-line hover:opacity-90 transition-opacity"
                />
                </a>
              ))}
              </div>
        </div>
      </div>
    </div>
  );
}