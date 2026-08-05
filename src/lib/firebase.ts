/* ============================================================================
   Firebase (client) dell'HUB — progetto SEPARATO da quelli operativi dei locali.
   ----------------------------------------------------------------------------
   Qui vivono i ristoratori (Auth) e i record `locali/{id}` dell'onboarding. I
   progetti operativi per-locale (ordini/cassa) sono altrove: questo è il
   control plane. La config arriva da env `VITE_FB_*` del progetto HUB.

   App Check non è ancora attivo: l'hub è esposto a registrazioni esterne, quindi
   andrà aggiunto (reCAPTCHA v3, come nel motore) prima del go-live pubblico. È un
   debito dichiarato, non un dimenticato.
   ========================================================================== */
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
