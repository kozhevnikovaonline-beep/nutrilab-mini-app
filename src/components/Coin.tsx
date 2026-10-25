import { useId } from 'react';

/** Монета «нутрик» — золотой диск с листиком. */
export function Coin({ size = 20 }: { size?: number }) {
  const id = useId();
  return (
    <svg className="coin" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="0.55" stopColor="#f4b63a" />
          <stop offset="1" stopColor="#c98512" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="15" fill={`url(#${id}g)`} />
      <circle cx="16" cy="16" r="11.5" fill="none" stroke="#fff3c9" strokeOpacity="0.6" strokeWidth="1.2" />
      <path
        d="M21.5 9.5c-6.5 0-10.5 3.6-10.5 9.2 0 .9.1 1.7.4 2.4 2-4.7 5.4-7.3 8.6-8.3-3.3 1.8-5.8 4.7-7.1 8.9.8.3 1.7.4 2.6.4 5.1 0 8-4.3 8-10.2 0-.8-.1-1.7-.3-2.4z"
        fill="#fff8de"
      />
    </svg>
  );
}

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="splash__logo">
      <rect width="64" height="64" rx="18" fill="rgba(255,255,255,0.14)" />
      <path
        d="M44 18c-14 0-24 8-24 22 0 2 .3 4 .8 5.6C26 34 34 28 42 26c-8 4-14 11-17 21 2 .7 4 1 6 1 12 0 19-10 19-24 0-2-.3-4-.8-6H44z"
        fill="#d4f58a"
      />
    </svg>
  );
}
