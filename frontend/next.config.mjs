import bundleAnalyzer from "@next/bundle-analyzer";

const composePublicEnv = {};
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

if (process.env.COMPOSE_FRONTEND_API_BASE_URL !== undefined) {
  composePublicEnv.NEXT_PUBLIC_API_BASE_URL =
    process.env.COMPOSE_FRONTEND_API_BASE_URL;
}

if (process.env.COMPOSE_FRONTEND_KAKAO_MAP_APP_KEY !== undefined) {
  composePublicEnv.NEXT_PUBLIC_KAKAO_MAP_APP_KEY =
    process.env.COMPOSE_FRONTEND_KAKAO_MAP_APP_KEY;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: composePublicEnv,
  images: {
    unoptimized: true,
  },
}

export default withBundleAnalyzer(nextConfig);
