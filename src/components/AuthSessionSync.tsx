
import { useCallback, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useScriptStore } from "../store/useScriptStore";

export default function AuthSessionSync() {
  const setAuthSession = useScriptStore((state) => state.setAuthSession);
  const setAuthReady = useScriptStore((state) => state.setAuthReady);
  const setSaveStatus = useScriptStore((state) => state.setSaveStatus);
  const syncUnsyncedScripts = useScriptStore((state) => state.syncUnsyncedScripts);
  const clearAuth = useScriptStore((state) => state.clearAuth);

  const syncForSessionUser = useCallback(
    async (userId: string) => {
      try {
        await syncUnsyncedScripts(userId);
      } catch {
        setSaveStatus("failed");
      }
    },
    [syncUnsyncedScripts, setSaveStatus]
  );

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      setAuthReady(false);

      try {
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (error) {
          setAuthSession(null);
          return;
        }

        const session = data.session ?? null;
        setAuthSession(session);

        if (session?.user?.id && navigator.onLine) {
          await syncForSessionUser(session.user.id);
        }
      } finally {
        if (isMounted) {
          setAuthReady(true);
        }
      }
    }

    void hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearAuth();
        return;
      }

      setAuthSession(session);

      if (session?.user?.id && navigator.onLine) {
        void syncForSessionUser(session.user.id);
      }
    });

    function handleOffline() {
      setSaveStatus("offline");
    }

    async function handleOnline() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (error) {
          clearAuth();
          return;
        }

        const session = data.session ?? null;
        setAuthSession(session);

        if (session?.user?.id) {
          await syncForSessionUser(session.user.id);
        }
      } catch {
        if (isMounted) {
          setSaveStatus("failed");
        }
      }
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [
    clearAuth,
    setAuthReady,
    setAuthSession,
    setSaveStatus,
    syncForSessionUser,
    syncUnsyncedScripts,
  ]);

  return null;
}
