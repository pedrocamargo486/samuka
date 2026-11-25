import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Footprints } from 'lucide-react';
import { db } from '../lib/firebase';
import { sanitizeImageUrl } from '../lib/utils';

interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
}

const mediaUrlCache = new Map<string, string>();

export function SmartImage({ src, alt, className = '', loading = 'lazy' }: SmartImageProps) {
  const safeSrc = sanitizeImageUrl(src);
  const [resolvedUrl, setResolvedUrl] = useState<string>(() => {
    if (!safeSrc) return '';
    if (safeSrc.startsWith('firestore-media://')) {
      return mediaUrlCache.get(safeSrc) || '';
    }
    return safeSrc;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!safeSrc) {
      setResolvedUrl('');
      return;
    }

    if (!safeSrc.startsWith('firestore-media://')) {
      setResolvedUrl(safeSrc);
      return;
    }

    const cached = mediaUrlCache.get(safeSrc);
    if (cached) {
      setResolvedUrl(cached);
      return;
    }

    let cancelled = false;
    const mediaId = safeSrc.replace('firestore-media://', '');
    if (!/^[a-zA-Z0-9_-]+$/.test(mediaId)) {
      setFailed(true);
      return;
    }

    getDoc(doc(db, 'media', mediaId))
      .then((snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          setFailed(true);
          return;
        }
        const data = snap.data() as { mimeType?: string; base64Data?: string };
        if (!data.base64Data || !data.mimeType) {
          setFailed(true);
          return;
        }
        const binary = atob(data.base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: data.mimeType });
        const objectUrl = URL.createObjectURL(blob);
        mediaUrlCache.set(safeSrc, objectUrl);
        setResolvedUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [safeSrc]);

  if (!resolvedUrl || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#F5F5F4] text-stone-400 select-none ${className}`}
        aria-label={alt}
      >
        <Footprints className="w-8 h-8 stroke-[1.5] mb-1.5" />
        <span className="text-[11px] font-medium tracking-wide text-stone-500 px-3 text-center line-clamp-1">
          {alt || 'Samuka Tênis'}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      loading={loading}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
