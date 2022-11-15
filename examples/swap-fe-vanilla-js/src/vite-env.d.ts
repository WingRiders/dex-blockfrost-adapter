/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BLOCKFROST_PROJECT_ID: string;
  // more env variables...
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  cardano?: {
    // the interface is documented in https://cips.cardano.org/cips/cip30/
    nufi?: any;
    eternl?: any;
    nami?: any;
  };
}
