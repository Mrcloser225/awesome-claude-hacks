import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@closer/core"],
  reactStrictMode: true,
};
export default config;
