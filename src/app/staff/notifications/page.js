'use client';
import { useEffect, useRef, useState } from 'react';

function playDing() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();

  function tone(freq, startTime, duration) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.8, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  const now = ctx.currentTime;
  tone(880, now, 0.4);
  tone(1318.5, now + 0.15, 0.5);
}

export default function StaffNotifications() {
  const [enabled, setEnabled] = useState(false);
  const seen = useRef(new Set());

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(async () => {
      const res = await fetch('/api/recent-uploads');
      const uploads = await res.json();
      for (const upload of uploads) {
        if (!seen.current.has(upload.id)) {
          seen.current.add(upload.id);
          playDing();
          new Notification('New graphic uploaded', { body: upload.name });
        }
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [enabled]);

  async function enableNotifications() {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') setEnabled(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="text-center">
        <h1 className="font-display font-bold uppercase text-2xl text-ink mb-4">Staff Notifications</h1>
        {enabled ? (
          <p className="text-ink-light">Listening for new uploads — keep this tab open.</p>
        ) : (
          <button onClick={enableNotifications} className="bg-brand-green text-white px-6 py-3 rounded-2xl font-semibold">
            Enable notifications
          </button>
        )}
      </div>
    </div>
  );
}