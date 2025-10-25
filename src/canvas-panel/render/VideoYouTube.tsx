import { useSimpleMediaPlayer } from '../../hooks/useSimpleMediaPlayer';
import { useOverlay } from '../context/overlays';
import { SingleYouTubeVideo } from '../../features/rendering-strategy/resource-types';
import { ReactNode, RefObject, useMemo, useRef } from 'react';
import * as React from 'react';

function extractYouTubeId(raw?: string | null) {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1);
    if (host.endsWith('youtube.com')) {
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1];
      if (u.searchParams.has('v')) return u.searchParams.get('v');
    }
  } catch {}
  return null;
}


export function VideoYouTubeHTML({
  element,
  media,
  onPlay,
  onPause,
  onEnded,
  
}: {
  element: RefObject<any>;
  media: SingleYouTubeVideo;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;

}) {
  const iframeLocalRef = React.useRef<HTMLIFrameElement>(null);
  const iframeRef = element;


  // 1) Calcule un ID local sans muter `media`
  const youTubeId = useMemo(
    () => media.youTubeId ?? extractYouTubeId((media as any).url),
    [media.youTubeId, (media as any).url]
  );

  if (!youTubeId) {
    return null;
  }

  // 2) `origin` complet et stable (SSR-safe)
  const originParam =
    typeof window !== 'undefined'
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : '';

  const src = `https://www.youtube.com/embed/${youTubeId}?enablejsapi=1&controls=0&disablekb=1&modestbranding=1&rel=0&iv_load_policy=3&fs=0&playsinline=1&rel=0${originParam}`;

  const iframeId = React.useMemo(
    () => (media as any).annotationId ?? `yt-${youTubeId}`,
    [youTubeId, (media as any).annotationId]
  );


  React.useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onMessage = (e: MessageEvent) => {
      // 1) Filtrer l’iframe cible
      if (e.source !== iframe.contentWindow) return;

      // 2) Vérifier l’origine
      const okOrigin =
        typeof e.origin === 'string' &&
        (e.origin.indexOf('youtube.com') !== -1 ||
         e.origin.indexOf('youtube-nocookie.com') !== -1);
      if (!okOrigin) return;

      // 3) Parser le payload
      let data: any;
      try {
        data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }

      console.log('YouTube message received:', data);

      // 4) État du player
      if (data?.event === 'onStateChange') {
        const s = data.info;
        if (s === 1) onPlay?.();
        else if (s === 2) onPause?.();
        else if (s === 0) onEnded?.();
      }
    };

    window.addEventListener('message', onMessage);
    const sendListening = () => {
      iframe.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: iframeId }),
        '*'
      );
    };
    // Au cas où l'iframe n’est pas encore prête
    const t = setTimeout(sendListening, 100);
    sendListening();

    return () => {
      clearTimeout(t);
      window.removeEventListener('message', onMessage);
    };
  }, [iframeId, iframeRef, onPlay, onPause, onEnded]);


  return (
    <div className="video-container" part="video-container">
      <style>
        {`
          .video-container {
            position: absolute;
            inset: 0;
            background: #000;
            z-index: 13;
            display: flex;
            justify-content: center;
            pointer-events: auto; /* 'visible' n'est pas valide */
          }
          .video-yt {
            border: none;
            width: 100%;
            height: 100%;
            object-fit: contain;
          }
        `}
      </style>

      <iframe
        id={iframeId}
        
        className="video-yt"
        ref={(el) => {
          iframeLocalRef.current = el;
          if (element) element.current = el;
        }}
        title="YouTube video player"
        src={src}
        allow="autoplay; encrypted-media; picture-in-picture"
        loading="lazy"
        // Important : éviter sandbox, il déclenche souvent l'erreur 153
        // Si tu DOIS le garder, ajoute au minimum:
        // sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-storage-access-by-user-activation"
      />
    </div>
  );
}


export function VideoYouTube({
  media,
  mediaControlsDeps,
  children,
}: {
  media: SingleYouTubeVideo;
  mediaControlsDeps?: any[];
  children: ReactNode;
}) {
  const [{ element, currentTime, progress }, state, actions] = useSimpleMediaPlayer({ duration: media.duration });

  useOverlay('overlay', 'video-element', VideoYouTubeHTML, {
    element,
    media,
    playPause: actions.playPause,
  });

  return null;
}
