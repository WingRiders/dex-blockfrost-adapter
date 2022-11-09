/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BLOCKFROST_PROJECT_ID: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
