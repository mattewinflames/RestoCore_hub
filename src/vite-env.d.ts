/* Tipi delle variabili d'ambiente dell'hub.
   Dichiarate a mano (non `vite/client`) perché in questo blocco l'hub è ancora
   headless: Vite/React entrano col blocco UI. Quando arriverà Vite, questa
   dichiarazione va sostituita da `/// <reference types="vite/client" />`. */
interface ImportMetaEnv {
  readonly VITE_FB_API_KEY: string;
  readonly VITE_FB_AUTH_DOMAIN: string;
  readonly VITE_FB_PROJECT_ID: string;
  readonly VITE_FB_STORAGE_BUCKET: string;
  readonly VITE_FB_SENDER_ID: string;
  readonly VITE_FB_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
