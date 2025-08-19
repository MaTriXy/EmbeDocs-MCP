/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['github.com', 'raw.githubusercontent.com'],
  },
  experimental: {
    optimizeCss: true,
  },
}

module.exports = nextConfig