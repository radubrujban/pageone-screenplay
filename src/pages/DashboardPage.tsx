import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import type { ScriptBlock } from "../types/script";
import type { CachedScript } from "../lib/db";
import type { TitlePageData } from "../lib/screenplayFormat";
import { cacheRemoteScripts, cacheScript, getCachedScriptsByUser } from "../lib/db";
import { useScriptStore } from "../store/useScriptStore";

type Script = {
  id: string;
  title: string;
  updated_at: number;
  blocks?: ScriptBlock[];
  title_page?: TitlePageData;
};

function mapCachedScripts(cached: CachedScript[]): Script[] {
  return cached.map((script: CachedScript) => ({
    id: script.id,
    title: script.title,
    blocks: script.blocks,
    updated_at: script.updatedAt,
  }));
}

export default function DashboardPage() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [renamingScript, setRenamingScript] = useState<Script | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const authReady = useScriptStore((state) => state.authReady);
  const authUserId = useScriptStore((state) => state.userId);
  const authSession = useScriptStore((state) => state.session);
  const setSaveStatus = useScriptStore((state) => state.setSaveStatus);
  const navigate = useNavigate();

  const sortedScripts = useMemo(
    () =>
      [...scripts].sort(
        (a: Script, b: Script) => (b.updated_at || 0) - (a.updated_at || 0)
      ),
    [scripts]
  );

  const recentScripts = useMemo(
    () => sortedScripts.slice(0, 8),
    [sortedScripts]
  );

  const newestScript = recentScripts[0] ?? null;

  const writingSnapshot = useMemo(() => {
    let pages = 0;
    let scenes = 0;
    let words = 0;

    for (const script of sortedScripts) {
      const blocks = script.blocks || [];
      scenes += blocks.filter(
        (block: ScriptBlock) =>
          block.type === "scene_heading" || block.type === "scene"
      ).length;
      words += blocks
        .map((block: ScriptBlock) => block.text.trim())
        .join(" ")
        .split(/\s+/)
        .filter(Boolean).length;
      pages += Math.max(1, Math.ceil(blocks.length / 45));
    }

    return {
      scripts: sortedScripts.length,
      pages,
      scenes,
      words,
    };
  }, [sortedScripts]);

  async function fetchScripts() {
    const id = authUserId ?? authSession?.user?.id ?? null;

    if (!id) {
      navigate("/login");
      return;
    }

    setUserId(id);
    const cached = await getCachedScriptsByUser(id);
    setScripts(mapCachedScripts(cached));

    if (!navigator.onLine) {
      setSaveStatus("offline");
      return;
    }

    try {
      const { data } = await supabase
        .from("scripts")
        .select("*")
        .eq("user_id", id)
        .order("updated_at", { ascending: false });

      if (data) {
        setScripts(data as Script[]);
        await cacheRemoteScripts(id, data as Script[]);
        setSaveStatus("saved");
        return;
      }
    } catch (error) {
      console.error(error);
      setSaveStatus(navigator.onLine ? "failed" : "offline");
      return;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialScripts() {
      if (!authReady) return;

      const id = authUserId ?? authSession?.user?.id ?? null;

      if (cancelled) return;

      if (!id) {
        navigate("/login");
        return;
      }

      setUserId(id);
      const cached = await getCachedScriptsByUser(id);

      if (!cancelled) {
        setScripts(mapCachedScripts(cached));
      }

      if (!navigator.onLine) {
        setSaveStatus("offline");
        return;
      }

      try {
        const { data } = await supabase
          .from("scripts")
          .select("*")
          .eq("user_id", id)
          .order("updated_at", { ascending: false });

        if (!cancelled && data) {
          setScripts(data as Script[]);
          await cacheRemoteScripts(id, data as Script[]);
          setSaveStatus("saved");
          return;
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setSaveStatus(navigator.onLine ? "failed" : "offline");
        }
        return;
      }
    }

    loadInitialScripts();

    return () => {
      cancelled = true;
    };
  }, [authReady, authSession?.user?.id, authUserId, navigate, setSaveStatus]);

  async function createNewScript() {
    let currentUserId = userId;

    if (!currentUserId) {
      currentUserId = authUserId ?? authSession?.user?.id ?? null;
      setUserId(currentUserId);
    }

    if (!currentUserId) {
      navigate("/login");
      return;
    }

    const newId = crypto.randomUUID();
    const updatedAt = Date.now();
    const blocks = [
      {
        id: crypto.randomUUID(),
        type: "action",
        text: "FADE IN:",
      },
    ] as ScriptBlock[];
    const titlePage: TitlePageData = {
      title: "Untitled Script",
      writtenBy: "",
      basedOn: "",
      contact: "",
      draftDate: new Date().toLocaleDateString(),
    };

    await cacheScript({
      id: newId,
      userId: currentUserId,
      title: "Untitled Script",
      blocks,
      titlePage,
      updatedAt,
      unsynced: !navigator.onLine,
    });

    if (navigator.onLine) {
      await supabase.from("scripts").insert({
        id: newId,
        user_id: currentUserId,
        title: "Untitled Script",
        blocks,
        title_page: titlePage,
        updated_at: updatedAt,
      });
      setSaveStatus("saved");
    } else {
      setSaveStatus("offline");
    }

    navigate(`/script/${newId}`);
  }

  async function deleteScript(id: string) {
    const confirmed = window.confirm("Delete this script? This cannot be undone.");
    if (!confirmed) return;

    if (!navigator.onLine) {
      setSaveStatus("offline");
      alert("Reconnect to delete scripts.");
      return;
    }

    await supabase.from("scripts").delete().eq("id", id);
    fetchScripts();
  }

  async function renameScript(id: string, newTitle: string) {
    const title = newTitle.trim() || "Untitled Script";

    if (!navigator.onLine) {
      setSaveStatus("offline");
      alert("Reconnect to rename scripts.");
      return;
    }

    await supabase
      .from("scripts")
      .update({ title })
      .eq("id", id);

    setRenamingScript(null);
    setRenameTitle("");
    fetchScripts();
  }

  function startRename(script: Script) {
    setRenamingScript(script);
    setRenameTitle(script.title || "Untitled Script");
  }

  function formatUpdatedAt(value: number) {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function openNewestScript() {
    if (!newestScript) return;
    navigate(`/script/${newestScript.id}`);
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-5xl space-y-8 sm:space-y-10">
        <section className="rounded-[2rem] border border-orange-100 bg-[#fff7ef] px-5 py-10 shadow-[0_10px_30px_rgba(194,99,46,0.08)] sm:px-8 sm:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              PageOne
            </p>

            <h1 className="mt-8 text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
              Write something real.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-zinc-600 sm:text-base">
              No AI. No noise. Just you and the page.
            </p>

            <div className="mt-9">
              <button
                onClick={createNewScript}
                className="rounded-xl border border-[#f2a56f] bg-[#ee9b63] px-7 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(238,155,99,0.25)] transition hover:bg-[#e78f56]"
              >
                Start Writing
              </button>
            </div>

            <div className="mt-5 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <button
                onClick={openNewestScript}
                disabled={!newestScript}
                className="rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Open Recent
              </button>
              <button
                onClick={() => alert("Templates are coming soon.")}
                className="rounded-lg border border-orange-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-orange-50"
              >
                Templates
              </button>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-600">
              Recent Scripts
            </h2>
            <button
              onClick={createNewScript}
              className="rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#a44f20] transition hover:bg-orange-100"
            >
              New Script
            </button>
          </div>

          {recentScripts.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-zinc-600">
                No drafts yet. Start writing and your scripts will appear here.
              </p>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-zinc-100">
              {recentScripts.map((script: Script) => (
                <li key={script.id} className="py-3.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      onClick={() => navigate(`/script/${script.id}`)}
                      className="text-left"
                    >
                      <p className="line-clamp-1 text-sm font-semibold text-zinc-900">
                        {script.title || "Untitled Script"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Updated {formatUpdatedAt(script.updated_at)}
                      </p>
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => startRename(script)}
                        className="text-xs font-semibold text-zinc-500 transition hover:text-zinc-900"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => deleteScript(script.id)}
                        className="text-xs font-semibold text-red-500 transition hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mx-auto w-full max-w-3xl rounded-xl border border-orange-100 bg-[#fffaf5] p-4 sm:p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-600">
            Writing Snapshot
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-orange-100 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Scripts</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{writingSnapshot.scripts}</p>
            </div>
            <div className="rounded-lg border border-orange-100 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Pages</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">~{writingSnapshot.pages}</p>
            </div>
            <div className="rounded-lg border border-orange-100 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Scenes</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{writingSnapshot.scenes}</p>
            </div>
            <div className="rounded-lg border border-orange-100 bg-white px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.12em] text-zinc-500">Words</p>
              <p className="mt-1 text-sm font-semibold text-zinc-900">{writingSnapshot.words}</p>
            </div>
          </div>
        </section>
      </div>

      {renamingScript && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 sm:px-6">
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 text-zinc-950 shadow-2xl sm:p-5">
            <h2 className="text-lg font-bold">Rename script</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Give this draft a clear working title.
            </p>

            <input
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              autoFocus
              className="mt-5 w-full rounded border border-zinc-300 bg-white px-4 py-3 text-zinc-950 outline-none transition focus:border-blue-500"
            />

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => {
                  setRenamingScript(null);
                  setRenameTitle("");
                }}
                className="rounded border border-zinc-300 px-4 py-2 text-sm font-bold text-zinc-700 transition hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                onClick={() => renameScript(renamingScript.id, renameTitle)}
                className="rounded bg-[#ee9b63] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#e78f56]"
              >
                Save Name
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
