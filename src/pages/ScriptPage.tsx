import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useScriptStore } from "../store/useScriptStore";
import ScriptEditor from "../components/ScriptEditor";
import { cacheRemoteScript, getCachedScript } from "../lib/db";
import AppLayout from "../components/AppLayout";
import type { TitlePageData } from "../lib/screenplayFormat";

function resolveTitlePage(
  title: string,
  input?: Partial<TitlePageData> | null
): TitlePageData {
  return {
    title: (input?.title ?? title ?? "Untitled Script").toString(),
    writtenBy: (input?.writtenBy ?? "").toString(),
    basedOn: (input?.basedOn ?? "").toString(),
    contact: (input?.contact ?? "").toString(),
    draftDate: (
      input?.draftDate ??
      new Date().toLocaleDateString()
    ).toString(),
  };
}

export default function ScriptPage() {
  const params = useParams();
  const id = params.id ?? null;
  const [offlineUnavailable, setOfflineUnavailable] = useState(false);

  const {
    setBlocks,
    setScriptId,
    setTitle,
    setTitlePage,
    setSaveStatus,
  } = useScriptStore();

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
        const cachedTitle = cached.title || "Untitled Script";
        setBlocks(cached.blocks || []);
        setTitle(cachedTitle);
        setTitlePage(resolveTitlePage(cachedTitle, cached.titlePage));
        setSaveStatus(
          !navigator.onLine ? "offline" : cached.unsynced ? "unsynced" : "saved"
        );
      }

      if (!navigator.onLine) {
        setSaveStatus("offline");

        if (!cached) {
          setBlocks([]);
          setTitle("Untitled Script");
          setTitlePage(resolveTitlePage("Untitled Script"));
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
          const remoteTitle = data.title || "Untitled Script";
          const remoteTitlePage = resolveTitlePage(
            remoteTitle,
            (data.title_page ?? data.titlePage) as Partial<TitlePageData> | null
          );
          setBlocks(data.blocks || []);
          setTitle(remoteTitle);
          setTitlePage(remoteTitlePage);
          setSaveStatus("saved");

          await cacheRemoteScript({
            id: data.id,
            userId: data.user_id || "",
            title: remoteTitle,
            blocks: data.blocks,
            titlePage: remoteTitlePage,
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
        setTitlePage(resolveTitlePage("Untitled Script"));
        setSaveStatus(navigator.onLine ? "failed" : "offline");
      }
    }

    void loadScript();

    return () => {
      cancelled = true;
    };
  }, [id, setBlocks, setSaveStatus, setScriptId, setTitle, setTitlePage]);

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
