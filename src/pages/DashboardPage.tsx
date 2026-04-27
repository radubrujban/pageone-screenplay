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
  const [aboutOpen, setAboutOpen] = useState(false);
  const [isEasterEggActive, setIsEasterEggActive] = useState(false);
  const authReady = useScriptStore((state) => state.authReady);
  const authUserId = useScriptStore((state) => state.userId);
  const authSession = useScriptStore((state) => state.session);
  const signOut = useScriptStore((state) => state.signOut);
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

  function getActiveUserId() {
    return userId ?? authUserId ?? authSession?.user?.id ?? null;
  }

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
    let currentUserId = getActiveUserId();

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
      const { error } = await supabase.from("scripts").insert({
        id: newId,
        user_id: currentUserId,
        title: "Untitled Script",
        blocks,
        title_page: titlePage,
        updated_at: updatedAt,
      });

      if (error) {
        setSaveStatus("failed");
        alert("Could not create script right now. Please try again.");
        return;
      }

      setSaveStatus("saved");
    } else {
      setSaveStatus("offline");
    }

    navigate(`/script/${newId}`);
  }

  async function deleteScript(id: string) {
    const confirmed = window.confirm("Delete this script? This cannot be undone.");
    if (!confirmed) return;
    const currentUserId = getActiveUserId();

    if (!currentUserId) {
      navigate("/login");
      return;
    }

    if (!navigator.onLine) {
      setSaveStatus("offline");
      alert("Reconnect to delete scripts.");
      return;
    }

    const { error } = await supabase
      .from("scripts")
      .delete()
      .eq("id", id)
      .eq("user_id", currentUserId);

    if (error) {
      setSaveStatus("failed");
      alert("Could not delete this script right now.");
      return;
    }

    await fetchScripts();
  }

  async function renameScript(id: string, newTitle: string) {
    const title = newTitle.trim() || "Untitled Script";
    const currentUserId = getActiveUserId();

    if (!currentUserId) {
      navigate("/login");
      return;
    }

    if (!navigator.onLine) {
      setSaveStatus("offline");
      alert("Reconnect to rename scripts.");
      return;
    }

    const { error } = await supabase
      .from("scripts")
      .update({ title })
      .eq("id", id)
      .eq("user_id", currentUserId);

    if (error) {
      setSaveStatus("failed");
      alert("Could not rename this script right now.");
      return;
    }

    setRenamingScript(null);
    setRenameTitle("");
    await fetchScripts();
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

  async function handleLogout() {
    try {
      await signOut();
    } catch (error) {
      console.error(error);
    } finally {
      setScripts([]);
      setUserId(null);
      navigate("/login", { replace: true });
    }
  }

  return (
    <AppLayout>
      <div className="relative min-h-[calc(100vh-56px)] overflow-x-hidden bg-[#fbf8f2] text-zinc-950">
        <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
          <section className="border-b border-zinc-300 pb-12">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-medium uppercase tracking-[0.28em] text-zinc-500">
                PageOne
              </p>
              <div className="flex items-center gap-5">
                <button
                  onClick={() => setAboutOpen(true)}
                  className="text-[9px] font-medium uppercase tracking-[0.28em] text-zinc-500 transition hover:text-zinc-700"
                >
                  about
                </button>
                <button
                  onClick={() => void handleLogout()}
                  className="text-[9px] font-medium uppercase tracking-[0.28em] text-zinc-500 transition hover:text-zinc-700"
                >
                  Log Out
                </button>
              </div>
            </div>

            <div className="relative mt-8">
              <h1 className="max-w-5xl text-[3.9rem] font-medium lowercase leading-[0.86] text-zinc-950 sm:text-[6.8rem] lg:max-w-4xl">
                write something.
              </h1>

              <div className="mt-8 flex flex-wrap items-center gap-3 lg:mt-10">
                <button
                  onClick={createNewScript}
                  className="inline-flex items-center border border-zinc-900/75 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-900 transition hover:bg-zinc-900 hover:text-[#fbf8f2]"
                >
                  Start Writing
                </button>
                <button
                  onClick={openNewestScript}
                  disabled={!newestScript}
                  className="inline-flex items-center border border-zinc-300 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-700 transition hover:border-zinc-900 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Open Recent
                </button>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <div>
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-[10px] font-medium uppercase tracking-[0.3em] text-zinc-600">
                  Recent Scripts
                </h2>
              </div>

              {recentScripts.length === 0 ? (
                <div className="mt-5 border-t border-zinc-300 pt-8">
                  <p className="text-[13px] leading-6 text-zinc-600">
                    No drafts yet. Start writing and your scripts will appear here.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 border-t border-zinc-300">
                  {recentScripts.map((script: Script, index) => (
                    <li key={script.id} className="border-b border-zinc-200 py-4">
                      <div className="grid gap-3 sm:grid-cols-[42px_minmax(0,1fr)_auto] sm:items-start">
                        <p className="text-[9px] font-medium uppercase tracking-[0.24em] text-zinc-500">
                          {String(index + 1).padStart(2, "0")}
                        </p>

                        <button
                          onClick={() => navigate(`/script/${script.id}`)}
                          className="text-left"
                        >
                          <p className="line-clamp-1 text-[15px] font-medium text-zinc-900">
                            {script.title || "Untitled Script"}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                            Updated {formatUpdatedAt(script.updated_at)}
                          </p>
                        </button>

                        <div className="flex items-center gap-4 sm:pt-0.5">
                          <button
                            onClick={() => startRename(script)}
                            className="text-[9px] font-medium uppercase tracking-[0.2em] text-zinc-500 transition hover:text-zinc-900"
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => deleteScript(script.id)}
                            className="text-[9px] font-medium uppercase tracking-[0.2em] text-red-500 transition hover:text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <button
          type="button"
          aria-label="easter egg"
          onMouseEnter={() => setIsEasterEggActive(true)}
          onMouseLeave={() => setIsEasterEggActive(false)}
          className="absolute bottom-2 left-1/2 inline-flex w-fit -translate-x-1/2 p-0 text-[8px] lowercase leading-none text-zinc-400/30"
        >
          fuck you
        </button>
      </div>

      {isEasterEggActive && (
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center">
          <p className="select-none text-center text-[24vw] font-semibold lowercase leading-[0.82] tracking-[0.08em] text-black">
            fuck you!
          </p>
        </div>
      )}

      {aboutOpen && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center bg-black/25 px-4 pt-16 sm:px-6 sm:pt-20"
          onClick={() => setAboutOpen(false)}
        >
          <div
            className="w-full max-w-xl border border-zinc-300 bg-[#fbf8f2] p-6 sm:p-8"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="whitespace-pre-line text-[13px] leading-7 lowercase text-zinc-700">
              {"hey, i'm radu.\n\ni made this because i'm not paying $200 for Final Draft, and apparently coding is kinda fun.\n\ni've spent the last year building PageOne between work, work, and work. i wanted a place to write screenplays without making it over complicated, expensive, or full of stuff i didn't ask for.\n\nso this is thing i came up with. a free(to you), still in progress, easy to use, easy to understand, (until i decide to add more features and completely break this thing) app made for writing first.\n\nenjoy!"}
            </p>
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setAboutOpen(false)}
                className="text-[9px] font-medium lowercase tracking-[0.24em] text-zinc-500 transition hover:text-zinc-700"
              >
                close
              </button>
            </div>
          </div>
        </div>
      )}

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
