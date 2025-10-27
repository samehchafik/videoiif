type MediaLike = {
  play(): void;
  pause(): void;
  get paused(): boolean;
  get currentTime(): number;
  set currentTime(s: number);
  get muted(): boolean;
  set muted(v: boolean);
  get volume(): number;      // 0..100
  set volume(v: number);
};

export function createYouTubeHandle(iframe: HTMLIFrameElement): MediaLike {
  let paused = true;
  let time = 0;      // on maintient une estimation locale
  let vol = 100;
  let muted = false;
  let t0 = 0;

  const send = (func: string, args: any[] = []) => {
    iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  };

  const tick = () => {
    if (!paused) {
      const now = performance.now();
      time += (now - t0) / 1000;
      t0 = now;
      requestAnimationFrame(tick);
    }
  };

  return {
    play() {
      paused = false;
      t0 = performance.now();
      send('playVideo');
      requestAnimationFrame(tick);
    },
    pause() {
      paused = true;
      send('pauseVideo');
    },
    get paused() { return paused; },

    get currentTime() { return time; },
    set currentTime(s: number) {
      time = Math.max(0, s);
      send('seekTo', [ time, true ]);
    },

    get muted() { return muted; },
    set muted(v: boolean) {
      muted = v;
      send(v ? 'mute' : 'unMute');
    },

    get volume() { return vol; },          // 0..100
    set volume(v: number) {
      vol = Math.max(0, Math.min(100, v));
      send('setVolume', [ vol ]);
    },
  };
}
