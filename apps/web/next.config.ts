import type { NextConfig } from 'next';
import { config } from 'dotenv';

config({ path: '../../.env', quiet: true });

const nextConfig: NextConfig = {
  eslint: {
    // ESLint runs as an explicit root/CI gate with the shared flat configuration.
    ignoreDuringBuilds: true,
  },
  output: 'standalone',
  reactStrictMode: true,
  serverExternalPackages: ['@prisma/client'],
  transpilePackages: [
    '@profitopath/database',
    '@profitopath/shared',
    '@profitopath/ui',
  ],
};

export default nextConfig;
