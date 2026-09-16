import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  // Repository instructions are maintained in the root AGENTS.md.
  agentRules: false,
  // Private documents permit 5 MB files; allow multipart overhead while the
  // action validates each file's size, signature, ownership and document type.
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
};
export default nextConfig;
