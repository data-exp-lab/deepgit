/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // Enable Fast Refresh
    webpack: (config, { isServer }) => {
        // Add hot module replacement
        if (!isServer) {
            config.watchOptions = {
                poll: 1000, // Check for changes every second
                aggregateTimeout: 300, // Delay the rebuild for 300ms
            }
        }
        return config
    }
}

module.exports = nextConfig 