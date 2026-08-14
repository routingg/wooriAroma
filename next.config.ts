import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  /* config options here */
};

// Makes Cloudflare bindings (e.g. env.DB — see lib/db/client.ts) available
// to `next dev`, not just `wrangler dev`/deployed. See
// https://opennext.js.org/cloudflare/get-started
initOpenNextCloudflareForDev();

export default withNextIntl(nextConfig);
