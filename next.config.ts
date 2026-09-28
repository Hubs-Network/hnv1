import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to this project directory. Without this,
  // Next.js infers the root from the nearest lockfile and picks up a stray
  // package-lock.json in the home directory, emitting a "multiple lockfiles"
  // warning. Anchoring it here keeps file watching scoped to the project.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
