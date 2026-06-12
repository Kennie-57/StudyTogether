import { useEffect, useState } from 'react';
import './CountdownTimer.css';

/** Displays countdown from server-provided expiresAt only — no client-side room closure logic */
export default function CountdownTimer({ expiresAt }) {
  const [remaining, setRemaining] = useState(() => calcRemaining(expiresAt));

  useEffect(() => {
    setRemaining(calcRemaining(expiresAt));
    const id = setInterval(() => {
      setRemaining(calcRemaining(expiresAt));
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const { hours, minutes, seconds, expired } = remaining;

  return (
    <div className={`countdown ${expired ? 'countdown-expired' : ''}`}>
      <span className="countdown-label">Thời gian còn lại</span>
      <span className="countdown-value">
        {expired
          ? '00:00:00'
          : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`}
      </span>
    </div>
  );
}

function calcRemaining(expiresAt) {
  if (!expiresAt) return { hours: 0, minutes: 0, seconds: 0, expired: true };
  const diff = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const expired = diff === 0;
  const totalSec = Math.floor(diff / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { hours, minutes, seconds, expired };
}

function pad(n) {
  return String(n).padStart(2, '0');
}
