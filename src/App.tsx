import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthChange } from "./lib/auth";
import AuthScreen from "./pages/AuthScreen";
import Home from "./pages/Home";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthChange notifica lo stato iniziale e ogni cambiamento successivo.
    const unsub = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return <div className="rc-loading">Un attimo…</div>;
  return user ? <Home user={user} /> : <AuthScreen />;
}
