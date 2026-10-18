export const youtubeId = /^[A-Za-z0-9_-]{11}$/;
export function parseYouTube(value: string): string | null {
  if (value.length > 2048) return null;
  try {
    const u = new URL(value.trim());
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    let id: string | null = null;
    if (u.hostname === "youtu.be" && /^\/[^/]+\/?$/.test(u.pathname)) id = u.pathname.split("/")[1];
    if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname)) {
      if (u.pathname === "/watch" && u.searchParams.getAll("v").length === 1) id = u.searchParams.get("v");
      else if (/^\/shorts\/[^/]+\/?$/.test(u.pathname)) id = u.pathname.split("/")[2];
    }
    return id && youtubeId.test(id) ? id : null;
  } catch { return null; }
}
