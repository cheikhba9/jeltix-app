/** @type {import('next').NextConfig} */
const nextConfig = {
  // ─── Sécurité & Performance ────────────────────────────────────────────────
  poweredByHeader: false,
  compress: true,

  // ─── Image Optimization ───────────────────────────────────────────────────
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 86400,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
        pathname: '/**',
      },
    ],
  },

  // ─── Tree-Shake Heavy Icon Packages ───────────────────────────────────────
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
