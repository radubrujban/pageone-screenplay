import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useScriptStore } from "../store/useScriptStore";
import ScriptEditor from "../components/ScriptEditor";
import { cacheRemoteScript, getCachedScript } from "../lib/db";
import AppLayout from "../components/AppLayout";

export default function ScriptPage() {
  const params = useParams();
  const id = params.id ?? null;
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);

  const { setBlocks, setScriptId, setTitle, setSaveStatus } = useScriptStore();

  useEffect(() => {
    if (!id) return;
    const scriptId = id;
    let cancelled = false;

    async function loadScript() {
      setOfflineUnavailable(false);
      setScriptId(scriptId);
      const cached = await getCachedScript(scriptId);

      if (cancelled) return;

      if (cached) {
        setBlocks(cached.blocks || []);
        setTitle(cached.title || "Untitled Script");
        setSaveStatus(
          !navigator.onLine ? "offline" : cached.unsynced ? "unsynced" : "saved"
        );
      }

      if (!navigator.onLine) {
        setSaveStatus("offline");

        if (!cached) {
          setBlocks([]);
          setTitle("Untitled Script");
          setOfflineUnavailable(true);
        }

        return;
      }

      try {
        const { data, error } = await supabase
          .from("scripts")
          .select("*")
          .eq("id", scriptId)
          .single();

        if (cancelled) return;

        if (error) {
          throw error;
        }

        if (data) {
          setBlocks(data.blocks || []);
          setTitle(data.title || "Untitled Script");
          setSaveStatus("saved");

          await cacheRemoteScript({
            id: data.id,
            userId: data.user_id || "",
            title: data.title,
            blocks: data.blocks,
            updatedAt: data.updated_at ?? Date.now(),
          });
        }
      } catch (error) {
        console.error(error);

        if (cancelled) return;

        if (cached) {
          setSaveStatus(navigator.onLine ? "failed" : "offline");
          return;
        }

        setBlocks([]);
        setTitle("Untitled Script");
        setSaveStatus(navigator.onLine ? "failed" : "offline");
      }
    }

    void loadScript();

    return () => {
      cancelled = true;
    };
  }, [id, setBlocks, setScriptId, setSaveStatus, setTitle]);

  if (offlineUnavailable) {
    return (
      <AppLayout showSaveStatus>
        <div className="flex min-h-[60vh] items-center justify-center text-center">
          <p className="max-w-md text-sm leading-6 text-zinc-600">
            This script is not available offline yet. Reconnect once to cache it.
          </p>
        </div>
      </AppLayout>
    );
  }

  return <ScriptEditor />;
}
