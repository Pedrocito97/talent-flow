import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Exclude Prisma from edge runtime bundling
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
