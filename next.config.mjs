/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@grpc/grpc-js", "@grpc/proto-loader"],
  outputFileTracingIncludes: {
    "/api/youtube/stream": ["./proto/youtube_live_chat.proto"],
  },
};

export default nextConfig;
