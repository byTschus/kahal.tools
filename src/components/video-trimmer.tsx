"use client";

import { useEffect, useRef, useState } from "react";

type YouTubePlayer = { getCurrentTime(): number; destroy(): void };
type YouTubeApi = { Player: new (element: HTMLElement, options: { videoId: string; playerVars: Record<string, number>; events: { onReady: () => void } }) => YouTubePlayer };

declare global {
  interface Window { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void }
}

let apiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube Player API wurde nicht geladen"));
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("YouTube Player API konnte nicht geladen werden"));
      document.head.appendChild(script);
    }
  });
  return apiPromise;
}

function formatTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return [hours, minutes, secs].map(part => String(part).padStart(2, "0")).join(":");
}

export function VideoTrimmer({ videoId }: { videoId: string }) {
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;
    loadYouTubeApi().then(api => {
      if (!active || !mount.current) return;
      player.current = new api.Player(mount.current, {
        videoId,
        playerVars: { playsinline: 1, rel: 0 },
        events: { onReady: () => {
          if (!active) return;
          setReady(true);
          timer = window.setInterval(() => {
            const position = player.current?.getCurrentTime();
            if (typeof position === "number" && Number.isFinite(position)) setCurrent(position);
          }, 250);
        } },
      });
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "YouTube-Vorschau konnte nicht geladen werden"); });
    return () => {
      active = false;
      if (timer) window.clearInterval(timer);
      player.current?.destroy();
      player.current = null;
    };
  }, [videoId]);

  function currentPosition() {
    const position = player.current?.getCurrentTime();
    return typeof position === "number" && Number.isFinite(position) ? position : current;
  }

  return <div className="video-trimmer">
    <div className="youtube-player" ref={mount}/>
    {error && <p className="alert">{error}</p>}
    <div className="playhead"><strong>Aktuelle Position</strong><span>{formatTime(current)}</span><small>{ready ? "Player bereit" : "Player wird geladen…"}</small></div>
    <div className="marker-grid">
      <div><span>Startpunkt</span><strong>{formatTime(start)}</strong><button type="button" disabled={!ready} className="secondary-button" onClick={() => { const value = currentPosition(); setCurrent(value); setStart(value); }}>Aktuelle Position als Start</button></div>
      <div><span>Endpunkt</span><strong>{end ? formatTime(end) : "Noch nicht gesetzt"}</strong><button type="button" disabled={!ready} className="secondary-button" onClick={() => { const value = currentPosition(); setCurrent(value); setEnd(value); }}>Aktuelle Position als Ende</button></div>
    </div>
    <p className="fine-print marker-help">Spule im YouTube-Player zur gewünschten Stelle und setze danach den jeweiligen Schnittpunkt. Die Werte können unten bei Bedarf sekundengenau korrigiert werden.</p>
    <div className="form-grid"><label>Start in Sekunden<input name="startSecondsOverride" type="number" min="0" step="0.001" value={start} onChange={event => setStart(Number(event.target.value))}/></label><label>Ende in Sekunden<input name="endSecondsOverride" type="number" min="0.001" step="0.001" value={end || ""} onChange={event => setEnd(Number(event.target.value))}/></label></div>
  </div>;
}
