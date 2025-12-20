import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Exclude packages from bundling (they'll be required at runtime)
  serverExternalPackages: ['@prisma/client', 'bcryptjs', 'pdfjs-dist'],

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
