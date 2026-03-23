import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

// Loads YouTube IFrame API once globally
let ytApiReady = false;
let ytApiCallbacks = [];
function loadYTApi() {
  if (ytApiReady) return;
  if (window.YT?.Player) { ytApiReady = true; return; }
  if (!document.getElementById("yt-api-script")) {
    const script = document.createElement("script");
    script.id = "yt-api-script";
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  }
  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    ytApiCallbacks.forEach((cb) => cb());
    ytApiCallbacks = [];
  };
}
function onYTReady(cb) {
  if (ytApiReady) cb();
  else ytApiCallbacks.push(cb);
}

const YouTubePlayer = forwardRef(function YouTubePlayer({ videoId, onReady, onStateChange }, ref) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);

  useImperativeHandle(ref, () => ({
    play: () => playerRef.current?.playVideo(),
    pause: () => playerRef.current?.pauseVideo(),
    seekTo: (t) => playerRef.current?.seekTo(t, true),
    getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
    isPaused: () => {
      const state = playerRef.current?.getPlayerState();
      return state !== 1; // 1 = playing
    },
  }));

  useEffect(() => {
    loadYTApi();
    let player;
    onYTReady(() => {
      if (!containerRef.current) return;
      player = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            playerRef.current = player;
            onReady?.();
          },
          onStateChange: (e) => onStateChange?.(e.data),
        },
      });
    });
    return () => {
      try { player?.destroy(); } catch {}
      playerRef.current = null;
    };
  }, [videoId]); // eslint-disable-line

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: "#000" }}
    />
  );
});

export default YouTubePlayer;
