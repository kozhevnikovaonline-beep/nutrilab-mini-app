import { useState } from 'react';

interface MediaProps {
  src?: string;
  alt: string;
  emoji: string;
}

/** Изображение с плавным появлением и аккуратным фолбэком (градиент + эмодзи), если фото не загрузилось. */
export function Media({ src, alt, emoji }: MediaProps) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(src ? 'loading' : 'error');
  return (
    <div className="media">
      {state !== 'loaded' && (
        <div className="media__fallback" aria-hidden="true">
          {state === 'error' ? emoji : null}
        </div>
      )}
      {src && state !== 'error' && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          data-loaded={state === 'loaded'}
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
        />
      )}
    </div>
  );
}
