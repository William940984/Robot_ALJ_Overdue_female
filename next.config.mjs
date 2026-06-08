/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the v0 preview proxy domains to access dev resources (HMR, /_next assets).
  // Without this, Next.js 16 blocks cross-origin requests, breaking CSS and interactivity.
  allowedDevOrigins: ["*.vusercontent.net", "*.v0.dev", "*.v0.app"],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
