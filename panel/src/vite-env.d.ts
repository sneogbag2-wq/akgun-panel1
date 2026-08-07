/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CURRENT_STOCK_V2?: string;
  readonly VITE_GEMINI_API_KEY?: string;
  /** Ek/yedek Gemini API anahtarları: VITE_GEMINI_API_KEY_2, VITE_GEMINI_API_KEY_3, ... */
  readonly [key: `VITE_GEMINI_API_KEY_${string}`]: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
