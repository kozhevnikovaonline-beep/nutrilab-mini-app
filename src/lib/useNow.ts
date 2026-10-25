import { useEffect, useState } from 'react';

/** Текущее время, обновляемое с заданным интервалом (для таймеров энергии и бонусов). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
