import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      // Plural URL alias (query e.g. ?id= is preserved by Next.js)
      { source: "/books", destination: "/book", permanent: false },
    ];
  },
};

export default nextConfig;
