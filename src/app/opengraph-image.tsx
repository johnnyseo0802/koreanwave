import { ImageResponse } from "next/og";
import { brand } from "@/lib/brand";
export const alt = "KGROOV — Korea Is a Vibe. Find Your Groove.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F6F5F0", padding: 64, color: "#171717" }}>
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, fontWeight: 700 }}><span>{brand.name}</span><span>{brand.tagline}</span></div>
    <div style={{ display: "flex", flexDirection: "column", fontSize: 116, fontWeight: 700, letterSpacing: -7, lineHeight: 1 }}><span>Korea Is</span><span style={{ display: "flex", alignSelf: "flex-start", background: "#D9FF70", padding: "0 24px 12px" }}>a Vibe.</span></div>
    <div style={{ display: "flex", fontSize: 24 }}>Trends. People. Places. Experiences.</div>
  </div>, size);
}
