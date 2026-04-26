import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import type { ScriptBlock } from "../types/script";
import type { CachedScript } from "../lib/db";
import { cacheRemoteScripts, cacheScript, getCachedScriptsByUser } from "../lib/db";
import { useScriptStore } from "../store/useScriptStore";

type Script = {
  id: string;
  title: string;
  updated_at: number;
  blocks?: ScriptBlock[];
};

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

  async function fetchScripts() {
    const id = authUserId ?? authSession?.user?.id ?? null;

    if (!id) {
      navigate("/login");
      return;
    }

    setUserId(id);

    if (navigator.onLine) {
      const { data } = await supabase
        .from("scripts")
        .select("*")
        .eq("user_id", id)
        .order("updated_at", { ascending: false });

      if (data) {
        setScripts(data as Script[]);
        await cacheRemoteScripts(id, data as Script[]);
        return;
      }
    }

    const cached = await getCachedScriptsByUser(id);
    setScripts(
      cached.map((script: CachedScript) => ({
        id: script.id,
        title: script.title,
        blocks: script.blocks,
        updated_at: script.updatedAt,
      }))
    );
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

      if (navigator.onLine) {
        const { data } = await supabase
          .from("scripts")
          .select("*")
          .eq("user_id", id)
          .order("updated_at", { ascending: false });

        if (!cancelled && data) {
          setScripts(data as Script[]);
          await cacheRemoteScripts(id, data as Script[]);
          return;
        }
      }

      const cached = await getCachedScriptsByUser(id);

      if (!cancelled) {
        setScripts(
          cached.map((script: CachedScript) => ({
            id: script.id,
            title: script.title,
            blocks: script.blocks,
            updated_at: script.updatedAt,
          }))
        );
      }
    }

    loadInitialScripts();

    return () => {
      cancelled = true;
    };
  }, [authReady, authSession?.user?.id, authUserId, navigate]);

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

    await cacheScript({
      id: newId,
      userId: currentUserId,
      title: "Untitled Script",
      blocks,
      updatedAt,
      unsynced: !navigator.onLine,
    });

    if (navigator.onLine) {
      await supabase.from("scripts").insert({
        id: newId,
        user_id: currentUserId,
        title: "Untitled Script",
        blocks,
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

    await supabase.from("scripts").delete().eq("id", id);
    fetchScripts();
  }

  async function renameScript(id: string, newTitle: string) {
    const title = newTitle.trim() || "Untitled Script";

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

  function scriptStats(script: Script) {
    const blocks = script.blocks || [];
    const scenes = blocks.filter((block: ScriptBlock) => block.type === "scene").length;
    const words = blocks
      .map((block: ScriptBlock) => block.text.trim())
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;
    const estimatedPages = Math.max(1, Math.ceil(blocks.length / 45));

    return { scenes, words, estimatedPages };
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

  return (
    <AppLayout showSaveStatus>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-5 border-b border-zinc-300 pb-6 sm:mb-10 sm:pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-zinc-500">
              Script Library
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Your Scripts</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
              Open a draft, review recent work, or start a new screenplay.
            </p>
          </div>

          <button
            onClick={createNewScript}
            className="w-full rounded bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500 sm:w-auto"
          >
            + New Script
          </button>
        </div>

        {scripts.length === 0 ? (
          <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-6 py-16 text-center shadow-sm">
            <div className="max-w-md">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-600">
                Blank page, clean start
              </p>
              <h2 className="mt-4 text-2xl font-bold">Create your first script</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Start with a fresh screenplay draft and keep your work organized in
                one focused library.
              </p>
              <button
                onClick={createNewScript}
                className="mt-6 rounded bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
              >
                New Script
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {scripts.map((script: Script) => {
              const stats = scriptStats(script);

              return (
                <article
                  key={script.id}
                  className="flex min-h-56 flex-col justify-between rounded border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg"
                >
                  <button
                    onClick={() => navigate(`/script/${script.id}`)}
                    className="text-left"
                  >
                    <p className="mb-3 text-xs text-zinc-500">
                      Updated {formatUpdatedAt(script.updated_at)}
                    </p>
                    <h2 className="line-clamp-2 text-xl font-bold leading-snug text-zinc-950">
                      {script.title || "Untitled Script"}
                    </h2>
                  </button>

                  <div>
                    <div className="mt-8 grid grid-cols-3 gap-2 border-y border-zinc-200 py-4">
                      <Stat label="Pages" value={`~${stats.estimatedPages}`} />
                      <Stat label="Scenes" value={stats.scenes} />
                      <Stat label="Words" value={stats.words} />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <button
                        onClick={() => navigate(`/script/${script.id}`)}
                        className="rounded border border-zinc-300 px-3 py-2 text-xs font-bold text-zinc-800 transition hover:bg-zinc-100"
                      >
                        Open
                      </button>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => startRename(script)}
                          className="text-xs font-bold text-zinc-500 transition hover:text-zinc-950"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => deleteScript(script.id)}
                          className="text-xs font-bold text-red-400 transition hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
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
                className="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500"
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

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-zinc-800">{value}</p>
    </div>
  );
}
