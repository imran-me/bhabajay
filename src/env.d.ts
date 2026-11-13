/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly PUBLIC_DELTA_URL?: string;
  readonly PUBLIC_FACEBOOK_URL?: string;
  readonly PUBLIC_YOUTUBE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'harfbuzzjs' {
  // CommonJS module exporting a Promise of the hbjs API (build-time only)
  const hb: Promise<unknown>;
  export default hb;
}
