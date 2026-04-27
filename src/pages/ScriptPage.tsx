import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useScriptStore } from "../store/useScriptStore";
import ScriptEditor from "../components/ScriptEditor";
import { cacheRemoteScript, getCachedScriptByUser } from "../lib/db";
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
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const {
    setBlocks,
    setScriptId,
    setTitle,
    setTitlePage,
    setSaveStatus,
  } = useScriptStore();
  const userId = useScriptStore((state) => state.userId);
  const sessionUserId = useScriptStore((state) => state.session?.user?.id ?? null);
  const activeUserId = userId ?? sessionUserId;

  useEffect(() => {
    if (!id) return;
    const scriptId = id;
    let cancelled = false;

    async function loadScript() {
      setBlockedMessage(null);
      const cached = activeUserId
        ? await getCachedScriptByUser(scriptId, activeUserId)
        : undefined;

      if (cancelled) return;

      if (cached) {
        const cachedTitle = cached.title || "Untitled Script";
        setScriptId(scriptId);
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
          setScriptId(null);
          setBlocks([]);
          setTitle("Untitled Script");
          setTitlePage(resolveTitlePage("Untitled Script"));
          setBlockedMessage(
            "This script is not available offline yet. Reconnect once to cache it."
          );
        }

        return;
      }

      if (!activeUserId) {
        setScriptId(null);
        setBlocks([]);
        setTitle("Untitled Script");
        setTitlePage(resolveTitlePage("Untitled Script"));
        setSaveStatus("failed");
        setBlockedMessage("Please sign in again to load this script.");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("scripts")
          .select("*")
          .eq("id", scriptId)
          .eq("user_id", activeUserId)
          .maybeSingle();

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
          setScriptId(scriptId);
          setBlocks(data.blocks || []);
          setTitle(remoteTitle);
          setTitlePage(remoteTitlePage);
          setSaveStatus("saved");

          await cacheRemoteScript({
            id: data.id,
            userId: activeUserId,
            title: remoteTitle,
            blocks: data.blocks,
            titlePage: remoteTitlePage,
            updatedAt: data.updated_at ?? Date.now(),
          });
          return;
        }

        if (!cached) {
          setScriptId(null);
          setBlocks([]);
          setTitle("Untitled Script");
          setTitlePage(resolveTitlePage("Untitled Script"));
          setSaveStatus("failed");
          setBlockedMessage("This script does not exist or you do not have access.");
        }
      } catch (error) {
        console.error(error);

        if (cancelled) return;

        if (cached) {
          setSaveStatus(navigator.onLine ? "failed" : "offline");
          return;
        }

        setScriptId(null);
        setBlocks([]);
        setTitle("Untitled Script");
        setTitlePage(resolveTitlePage("Untitled Script"));
        setSaveStatus(navigator.onLine ? "failed" : "offline");
        setBlockedMessage("Unable to load this script right now. Please try again.");
      }
    }

    void loadScript();

    return () => {
      cancelled = true;
    };
  }, [
    activeUserId,
    id,
    setBlocks,
    setSaveStatus,
    setScriptId,
    setTitle,
    setTitlePage,
  ]);

  if (blockedMessage) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center text-center">
          <p className="max-w-md text-sm leading-6 text-zinc-600">
            {blockedMessage}
          </p>
        </div>
      </AppLayout>
    );
  }

  return <ScriptEditor />;
}
