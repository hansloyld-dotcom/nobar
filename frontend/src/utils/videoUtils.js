/**
 * Detect video type and extract embed-friendly URL
 */
export function parseVideoUrl(url) {
  if (!url) return null;

  // YouTube
  const ytPatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const pat of ytPatterns) {
    const m = url.match(pat);
    if (m) {
      return {
        type: "youtube",
        embedUrl: `https://www.youtube.com/embed/${m[1]}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}&autoplay=0`,
        videoId: m[1],
        original: url,
      };
    }
  }

  // Google Drive
  const gdriveMatch = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  if (gdriveMatch) {
    return {
      type: "gdrive",
      embedUrl: `https://drive.google.com/file/d/${gdriveMatch[1]}/preview`,
      original: url,
    };
  }

  // Direct video file
  const directMatch = url.match(/\.(mp4|webm|mkv|ogg|mov|avi|m4v)(\?.*)?$/i);
  if (directMatch || url.includes("blob:") || url.includes(".m3u8")) {
    return {
      type: "direct",
      embedUrl: url,
      original: url,
    };
  }

  // Generic iframe (try to embed anything else)
  return {
    type: "iframe",
    embedUrl: url,
    original: url,
  };
}

export function generateRoomId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
