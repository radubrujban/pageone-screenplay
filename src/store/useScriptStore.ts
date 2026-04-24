import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type { ScriptBlock } from "../types/script";
import { supabase } from "../lib/supabase";

export type SaveStatusValue = "saved" | "saving" | "failed" | "unsynced" | "offline";

interface ScriptState {
  blocks: ScriptBlock[];
  scriptId: string | null;
  userId: string | null;
  session: Session | null;
  authReady: boolean;
  title: string;
  saveStatus: SaveStatusValue;

  setBlocks: (blocks: ScriptBlock[]) => void;
  setUserId: (id: string | null) => void;
  setAuthSession: (session: Session | null) => void;
  setScriptId: (id: string | null) => void;
  setTitle: (title: string) => void;
  setSaveStatus: (status: SaveStatusValue) => void;
  markUnsynced: () => void;

  saveScript: () => Promise<void>;
}

export const useScriptStore = create<ScriptState>((set, get) => ({
  blocks: [],
  scriptId: null,
  userId: null,
  session: null,
  authReady: false,
  title: "Untitled Script",
  saveStatus:
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "saved",

  setBlocks: (blocks) => set({ blocks }),
  setUserId: (id) => set({ userId: id }),
  setAuthSession: (session) =>
    set({
      session,
      userId: session?.user?.id ?? null,
      authReady: true,
    }),
  setScriptId: (id) => set({ scriptId: id }),
  setTitle: (title) => set({ title }),
  setSaveStatus: (status) => set({ saveStatus: status }),
  markUnsynced: () =>
    set({
      saveStatus:
        typeof navigator !== "undefined" && !navigator.onLine
          ? "offline"
          : "unsynced",
    }),

  saveScript: async () => {
    const { blocks, scriptId, userId, title } = get();

    if (!scriptId || !userId) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      set({ saveStatus: "offline" });
      throw new Error("Cannot save while offline.");
    }

    set({ saveStatus: "saving" });

    const { error } = await supabase.from("scripts").upsert({
      id: scriptId,
      user_id: userId,
      title: title || "Untitled Script",
      blocks,
      updated_at: Date.now(),
    });

    if (error) {
      set({ saveStatus: "failed" });
      throw error;
    }

    set({ saveStatus: "saved" });
  },
}));
