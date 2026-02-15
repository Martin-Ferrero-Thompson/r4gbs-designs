import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    __i18n_translations?: Record<string, Record<string, any>>;
    __getCurrentLang?: () => string;
  }
}

interface CountdownProps {
  targetDate: string;
  variant?: '1' | '4';
}

function getTranslatedLabel(key: string, fallback: string): string {
  try {
    const lang = window.__getCurrentLang?.() || 'en';
    const translations = window.__i18n_translations?.[lang];
    if (!translations) return fallback;
    const parts = key.split('.');
    let val: any = translations;
    for (const p of parts) {
      val = val?.[p];
    }
    return typeof val === 'string' ? val : fallback;
  } catch {
    return fallback;
  }
}

export default function Countdown({ targetDate, variant = '1' }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const [labels, setLabels] = useState({
    days: 'Days',
    hours: 'Hours',
    minutes: 'Minutes',
    seconds: 'Seconds',
  });

  const updateLabels = useCallback(() => {
    setLabels({
      days: getTranslatedLabel('countdown.days', 'Days'),
      hours: getTranslatedLabel('countdown.hours', 'Hours'),
      minutes: getTranslatedLabel('countdown.minutes', 'Minutes'),
      seconds: getTranslatedLabel('countdown.seconds', 'Seconds'),
    });
  }, []);

  useEffect(() => {
    const target = new Date(targetDate).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        clearInterval(interval);
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  // Listen for language changes
  useEffect(() => {
    updateLabels();
    const handler = () => updateLabels();
    document.addEventListener('lang-changed', handler);
    return () => document.removeEventListener('lang-changed', handler);
  }, [updateLabels]);

  const styles: Record<string, { container: string; number: string; label: string }> = {
    '1': {
      container: 'bg-stone-900/50 border-stone-800',
      number: 'text-amber-400',
      label: 'text-stone-500',
    },
    '4': {
      container: 'bg-[#0a0b0a] border-[#39FF14]/20',
      number: 'text-[#39FF14]',
      label: 'text-[#555]',
    },
  };

  const s = styles[variant] ?? styles['1'];

  const units = [
    { value: timeLeft.days, label: labels.days },
    { value: timeLeft.hours, label: labels.hours },
    { value: timeLeft.minutes, label: labels.minutes },
    { value: timeLeft.seconds, label: labels.seconds },
  ];

  return (
    <div className="flex gap-3 sm:gap-4">
      {units.map(({ value, label }) => (
        <div
          key={label}
          className={`flex flex-col items-center rounded-xl border px-3 py-3 sm:px-5 sm:py-4 ${s.container}`}
        >
          <span className={`font-display text-2xl sm:text-4xl font-bold tabular-nums ${s.number}`}>
            {String(value).padStart(2, '0')}
          </span>
          <span className={`text-[10px] sm:text-xs font-body uppercase tracking-wider mt-1 ${s.label}`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
