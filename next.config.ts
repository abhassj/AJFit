import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // An unrelated lockfile in the home directory makes Next infer the wrong
  // workspace root, so pin it to this project.
  turbopack: {
    root: path.join(__dirname),
  },
  // The default bottom-left dev badge sits directly on top of the Home tab in
  // the bottom navigation. Move it rather than disable it, so compile and
  // runtime errors still surface during development.
  devIndicators: {
    position: 'top-right',
  },
}

export default nextConfig
