import * as React from 'react';
import { HTMLPortal } from '@atlas-viewer/atlas';
import { useEffect, useLayoutEffect, useMemo, useCallback } from 'react';
import { useStore } from 'zustand';
import { ComplexTimelineProvider } from '../../context/ComplexTimelineContext';
import type { ComplexTimelineStrategy } from '../../features/rendering-strategy/strategies';
import { createComplexTimelineStore } from '../../future-helpers/complex-timeline-store';
import { useOverlay } from '../context/overlays';
import { RenderAnnotation } from './Annotation';
import { RenderAnnotationPage } from './AnnotationPage';
import { RenderImage } from './Image';
import { VideoYouTubeHTML } from './VideoYouTube';
import { RenderTextualContent } from './TextualContent';
import { useAtlas /* ou useAtlasStore */ } from '@atlas-viewer/atlas';
import { AtlasContext } from '@atlas-viewer/atlas';
import { createYouTubeHandle } from './YouTubeHandle';


const YouTubeItemImpl = React.memo(
  function YouTubeItemImpl({
    item,
    visible,
    store,
  }: { item: any; visible: boolean; store: ReturnType<typeof createComplexTimelineStore>['store'] }) {
    const iframeRef = React.useRef<HTMLIFrameElement | null>(null);

    React.useEffect(() => {
      if (!iframeRef.current) return;
      const handle = createYouTubeHandle(iframeRef.current);
      store.getState().setElement(item.annotationId, handle as any);
    }, [item.annotationId, store]);

    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          width: '100%',
          height: '100%',
        }}
      >
        <VideoYouTubeHTML element={iframeRef} media={item} playPause={() => {}} />
          <button
          type="button"
          aria-label="Play/Pause"
          onClick={(e) => {
            e.stopPropagation();
            store.getState().playPause();
          }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'transparent',
            border: 0,
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            zIndex: 20
          }}
        />
      </div>
    );
  },
  (prev, next) =>
    prev.visible === next.visible &&
    prev.item?.annotationId === next.item?.annotationId
);

// alias pratique
const YouTubeItem = YouTubeItemImpl;


export function RenderComplexTimeline({
  strategy,
  children,
}: {
  strategy: ComplexTimelineStrategy;
  children?: React.ReactNode;
}) {
  const storeRef = React.useRef<ReturnType<typeof createComplexTimelineStore> | null>(null);
const lastKeyRef = React.useRef<string | null>(null);

// une clé légère pour détecter un vrai changement pertinent
const stratKey = React.useMemo(
  () => JSON.stringify({
    dur: strategy.duration,
    k: strategy.keyframes?.length ?? 0,
    items: strategy.items?.length ?? 0,
  }),
  [strategy]
);

if (!storeRef.current) {
  storeRef.current = createComplexTimelineStore({ complexTimeline: strategy });
  lastKeyRef.current = stratKey;
} else if (lastKeyRef.current !== stratKey) {
  // ⚠️ même instance de store, on met l’état à jour
  const api = storeRef.current.store;
  api.setState({
    complexTimeline: strategy,
    duration: strategy.duration,
    // on remet le curseur de timeline proprement
    visibleElements: {},
    currentPrime: null,
    nextKeyframeIndex: 0,
  });
  api.getState().setTime(0);
  lastKeyRef.current = stratKey;
}

const store = storeRef.current.store; 

  const isReady = useStore(store, (s) => s.isReady);
  const visibleElements = useStore(store, (s) => s.visibleElements);
  const preset = React.useContext(AtlasContext);
  const runtime = preset?.runtime || null;

  // 2) fonction pan qui n'utilise pas de hook
  const panScreenByPx = useCallback((dxPx: number) => {
    if (!runtime) return;
    const scale = runtime.getScaleFactor();
    const dxWorld = dxPx / scale;
    runtime.setViewport({ x: runtime.x + dxWorld, y: runtime.y });
  }, [runtime]);
  const [isDesktop, setIsDesktop] = React.useState(false);
  useEffect(() => {
      if (typeof window === 'undefined') return;
      const mql = window.matchMedia('(min-width: 1024px) and (hover: hover) and (pointer: fine)');

      const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
        setIsDesktop('matches' in e ? e.matches : (e as MediaQueryList).matches);
      };

      onChange(mql);
      // compat older Safari
      const add = (mql as any).addEventListener ? 'addEventListener' : 'addListener';
      const rem = (mql as any).removeEventListener ? 'removeEventListener' : 'removeListener';
      (mql as any)[add]('change', onChange);

      return () => (mql as any)[rem]('change', onChange);
    }, []);
  
  const hasVisibleVideo = useMemo(
    () => strategy.items.some(i => i.type === 'Video' && !!visibleElements[i.annotationId]),
    [strategy.items, visibleElements]
  );

  useEffect(() => {
    if (!isDesktop || !runtime || !hasVisibleVideo) return;
    const id = setInterval(() => {
      clearInterval(id)
      panScreenByPx(260);
    }, 200);
    return () => clearInterval(id);
  }, [isDesktop, runtime, panScreenByPx]);


  function refFor(id: string) {
    
    return (el: HTMLVideoElement) => {
      if (el) {
        store.getState().setElement(id, el);
      }
    };
  }
  

  useEffect(() => {
    if (typeof document === 'undefined') return;      // sécurité SSR
    const el = document.getElementById("root");   
    if(el){                        // ou document.documentElement
      const cls = 'has-video';
      if (hasVisibleVideo) el.classList.add(cls);
      else el.classList.remove(cls);
      return () => el.classList.remove(cls);
    }
  }, [hasVisibleVideo]);


  useLayoutEffect(() => {
    if (isReady) {
      const { startClock, stopClock } = store.getState();
      startClock();
      return () => {
        stopClock();
      };
    }
  }, [strategy, isReady]);

  useOverlay(
    'portal',
    'custom-controls',
    ComplexTimelineProvider,
    {
      store,
      children,
    },
    [isReady],
  );

  

  return (
    <>
      {strategy.items.map((item) => {
        if (item.type !== 'Image') return null;
        if (!visibleElements[item.annotationId]) return null;
        return <RenderImage 
          key={item.id} 
          image={item}
          id={item.annotationId} />;
      })}

      

      {strategy.items.map((item, i) => {
        if (item.type !== 'Text') return null;
        if (!visibleElements[item.annotationId]) return null;

        return <RenderTextualContent key={i} strategy={{ type: 'textual-content', items: [item] }}  />;
      })}
      {strategy.items.map((item, i) => {
        if (item.type !== 'Video') return null;
        //if (!item.target.spatial) return null;
        const url = (item as any).url || item.annotation?.body?.[0]?.id || '';
        const isYT = /youtube\.com|youtu\.be/.test(url);
        
        if(isYT){
          const visible = !!visibleElements[item.annotationId];
          return <HTMLPortal className="video-container" key={i} target={item.target.spatial as any}>
            <YouTubeItem
              store={store} 
              item={item}
              visible={visible}  
            />
          </HTMLPortal>
        }
        else { 
          return (
            <HTMLPortal  className="video-container" key={i} target={item.target.spatial as any}>
              <video
                className="video"
                ref={refFor(item.annotationId)}
                src={item.url}
                style={{ height: '100%', width: '100%', opacity: visibleElements[item.annotationId] ? 1 : 0 }}
                playsInline
              />
            </HTMLPortal>
          );
        }
      })}
      {strategy.items.map((item, i) => {
        if (item.type !== 'Sound') return null;
        return (
          <HTMLPortal key={i}>
            <audio ref={refFor(item.annotationId)} src={item.url} />
          </HTMLPortal>
        );
      })}
      {strategy.highlights.map(({ annotation }) => {
        if (!visibleElements[annotation.id]) return null;
        return (
          <RenderAnnotation
            key={annotation.id}
            id={annotation.id}
            ignoreTargetId
            style={{ outline: '50px solid rgba(78, 86, 228, 0.4)' }}
            className="image-service-annotation"
          />
        );
      })}
      
    </>
  );
}
