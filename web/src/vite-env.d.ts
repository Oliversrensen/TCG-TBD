/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TCG_SERVER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
