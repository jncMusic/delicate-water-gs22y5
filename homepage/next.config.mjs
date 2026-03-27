/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.jncmusic.kr' }],
        destination: 'https://jncmusic.kr/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
