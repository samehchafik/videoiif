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
import { RenderTextualContent } from './TextualContent';
import { useAtlas /* ou useAtlasStore */ } from '@atlas-viewer/atlas';
import { AtlasContext } from '@atlas-viewer/atlas';



function panScreenByPx( dxPx: number) {

  //const atlasStore = useAtlas();
  const preset = React.useContext(AtlasContext);
  if (!preset) return null;
  const r = preset.runtime;
  const scale = r.getScaleFactor();          // px viewer -> unités monde
  const dxWorld = dxPx / scale; 
  
  r.setViewport({ x: r.x + dxWorld, y: r.y });
  
}

export function RenderComplexTimeline({
  strategy,
  children,
}: {
  strategy: ComplexTimelineStrategy;
  children?: React.ReactNode;
}) {
  const { store } = useMemo(() => {
    return createComplexTimelineStore({ complexTimeline: strategy });
  }, [strategy]);

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

  useEffect(() => {
    if (!isDesktop || !runtime) return;
    const id = setInterval(() => {
      clearInterval(id)
      panScreenByPx(150);
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
  const hasVisibleVideo = useMemo(
    () => strategy.items.some(i => i.type === 'Video' && !!visibleElements[i.annotationId]),
    [strategy.items, visibleElements]
  );

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
        
        return (
          <HTMLPortal key={i} target={item.target.spatial as any}>
            <video
              ref={refFor(item.annotationId)}
              src={item.url}
              style={{ height: '100%', width: '100%', opacity: visibleElements[item.annotationId] ? 1 : 0 }}
            />
          </HTMLPortal>
        );
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
            style={{ outline: '3px solid red' }}
            className="image-service-annotation"
          />
        );
      })}
      
    </>
  );
}
