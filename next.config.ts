import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // An unrelated lockfile in the home directory makes Next infer the wrong
  // workspace root, so pin it to this project.
  turbopack: {
    root: path.join(__dirname),
  },
}

export default nextConfig
