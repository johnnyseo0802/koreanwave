import type { NextConfig } from "next";
import { mediaOrigin } from "./src/lib/media";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: mediaOrigin() ? [{ protocol: "https", hostname: new URL(mediaOrigin()!).hostname, pathname: "/storage/v1/object/public/site-media/images/**", search: "" }] : [],
    maximumRedirects: 0,
  },
};

export default nextConfig;
