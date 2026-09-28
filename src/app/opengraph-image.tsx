import { ImageResponse } from "next/og";
export const alt = "Korean Wave Community — Discover Korea Beyond the Screen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", background: "#eef3e7", padding: 80, color: "#17201d" }}><div style={{ fontSize: 28, color: "#557b39", marginBottom: 45 }}>KOREAN WAVE COMMUNITY</div><div style={{ fontSize: 76, fontWeight: 700 }}>Discover Korea</div><div style={{ fontSize: 76, color: "#557b39" }}>Beyond the Screen</div><div style={{ fontSize: 26, marginTop: 40 }}>Culture · Local discoveries · Community</div></div>, size);
}
