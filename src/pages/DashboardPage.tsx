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
      scenes += blocks.filter((block: ScriptBlock) => block.type === "scene").length;
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
    <AppLayout showSaveStatus>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl border border-zinc-300 bg-zinc-100 text-xl font-bold tracking-wide text-zinc-700">
                P1
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
                Welcome to PageOne
              </h1>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Start a new draft fast, open recent work, and jump into writing.
              </p>
              <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                Build Preview
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <LaunchTile
                title="Quick Start"
                subtitle="Create a new script"
                onClick={createNewScript}
                highlighted
              />
              <LaunchTile
                title="Idea to Script"
                subtitle="Turn notes into a first draft"
                onClick={() => alert("Idea to Script is coming soon.")}
              />
              <LaunchTile
                title="Choose Template"
                subtitle="Start from screenplay templates"
                onClick={() => alert("Templates are coming soon.")}
              />
              <LaunchTile
                title="Open Recent"
                subtitle={
                  newestScript
                    ? `Open ${newestScript.title || "Untitled Script"}`
                    : "No recent scripts yet"
                }
                onClick={openNewestScript}
                disabled={!newestScript}
              />
            </div>
          </section>

          <aside className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 pb-3">
              <h2 className="text-base font-semibold text-zinc-900">Recent Scripts</h2>
              <button
                onClick={createNewScript}
                className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                New
              </button>
            </div>

            {recentScripts.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-zinc-600">
                  No scripts yet. Start your first draft.
                </p>
              </div>
            ) : (
              <ul className="mt-3 space-y-2">
                {recentScripts.map((script: Script) => (
                  <li
                    key={script.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-3"
                  >
                    <button
                      onClick={() => navigate(`/script/${script.id}`)}
                      className="w-full text-left"
                    >
                      <p className="line-clamp-1 text-sm font-semibold text-zinc-900">
                        {script.title || "Untitled Script"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Updated {formatUpdatedAt(script.updated_at)}
                      </p>
                    </button>

                    <div className="mt-2 flex items-center gap-3">
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
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-600">
              Writing Snapshot
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Scripts" value={writingSnapshot.scripts} />
              <Stat label="Pages" value={`~${writingSnapshot.pages}`} />
              <Stat label="Scenes" value={writingSnapshot.scenes} />
              <Stat label="Words" value={writingSnapshot.words} />
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-600">
              More
            </h3>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button
                onClick={() => alert("Resources coming soon.")}
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                Resources
              </button>
              <button
                onClick={() => alert("Settings coming soon.")}
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                Settings
              </button>
              <button
                onClick={() => alert("Import Script coming soon.")}
                className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
              >
                Import Script
              </button>
            </div>
          </section>
        </div>
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

function LaunchTile({
  title,
  subtitle,
  onClick,
  highlighted = false,
  disabled = false,
}: {
  title: string;
  subtitle: string;
  onClick: () => void;
  highlighted?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border p-4 text-left transition ${
        highlighted
          ? "border-blue-500 bg-blue-50 hover:bg-blue-100"
          : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <p className="text-sm font-semibold text-zinc-900">{title}</p>
      <p className="mt-1 text-xs text-zinc-600">{subtitle}</p>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-zinc-800">{value}</p>
    </div>
  );
}
