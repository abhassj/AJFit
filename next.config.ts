import path from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // An unrelated lockfile in the home directory makes Next infer the wrong
  // workspace root, so pin it to this project.
  turbopack: {
    root: path.join(__dirname),
  },
  /*
   * At the mobile widths this app is designed for, the dev badge overlaps a
   * real control in every corner: bottom-left/right hit the navigation tabs,
   * top-left the back link, top-right the Program edit button. It also
   * intercepts pointer events, which blocks those controls outright. Next still
   * surfaces compile and runtime errors with the indicator hidden.
   */
  devIndicators: false,
}

export default nextConfig
