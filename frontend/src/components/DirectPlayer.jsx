import { useRef, useImperativeHandle, forwardRef } from "react";

const DirectPlayer = forwardRef(function DirectPlayer({ url, type }, ref) {
  const videoRef = useRef(null);

  useImperativeHandle(ref, () => ({
    play: () => videoRef.current?.play(),
    pause: () => videoRef.current?.pause(),
    seekTo: (t) => { if (videoRef.current) videoRef.current.currentTime = t; },
    getCurrentTime: () => videoRef.current?.currentTime ?? 0,
    isPaused: () => videoRef.current?.paused ?? true,
  }));

  if (type === "gdrive" || type === "iframe") {
    return (
      <iframe
        src={url}
        style={{ width: "100%", height: "100%", border: "none", background: "#000" }}
        allow="autoplay; fullscreen"
        allowFullScreen
        title="Video Player"
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={url}
      style={{ width: "100%", height: "100%", background: "#000" }}
      controls
      playsInline
      preload="metadata"
    />
  );
});

export default DirectPlayer;
