import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useScriptStore } from "../store/useScriptStore";

export default function AuthSessionSync() {
  const setAuthSession = useScriptStore((state) => state.setAuthSession);

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error) {
        setAuthSession(null);
        return;
      }

      setAuthSession(data.session ?? null);
    }

    hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [setAuthSession]);

  return null;
}
