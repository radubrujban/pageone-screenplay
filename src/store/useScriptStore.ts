import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type { ScriptBlock } from "../types/script";
import { supabase } from "../lib/supabase";
import {
  cacheScript,
  getUnsyncedScriptsByUser,
} from "../lib/db";

export type SaveStatusValue =
  | "saved"
  | "syncing"
  | "failed"
  | "unsynced"
  | "offline";

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
  setAuthReady: (ready: boolean) => void;
  clearAuth: () => void;
  setScriptId: (id: string | null) => void;
  setTitle: (title: string) => void;
  setSaveStatus: (status: SaveStatusValue) => void;
  markUnsynced: () => void;

  saveScript: () => Promise<void>;
  syncUnsyncedScripts: (forcedUserId?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
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
    }),
  setAuthReady: (ready) => set({ authReady: ready }),
  clearAuth: () =>
    set({
      session: null,
      userId: null,
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

    const updatedAt = Date.now();

    await cacheScript({
      id: scriptId,
      userId,
      title: title || "Untitled Script",
      blocks,
      updatedAt,
      unsynced: true,
    });

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      set({ saveStatus: "offline" });
      return;
    }

    set({ saveStatus: "syncing" });

    const { error } = await supabase.from("scripts").upsert({
      id: scriptId,
      user_id: userId,
      title: title || "Untitled Script",
      blocks,
      updated_at: updatedAt,
    });

    if (error) {
      set({ saveStatus: "failed" });
      throw error;
    }

    await cacheScript({
      id: scriptId,
      userId,
      title: title || "Untitled Script",
      blocks,
      updatedAt,
      unsynced: false,
    });

    set({ saveStatus: "saved" });
  },

  syncUnsyncedScripts: async (forcedUserId) => {
    const { userId, saveStatus } = get();
    const activeUserId = forcedUserId ?? userId;

    if (!activeUserId) return;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      set({ saveStatus: "offline" });
      return;
    }

    const unsynced = await getUnsyncedScriptsByUser(activeUserId);

    if (unsynced.length === 0) {
      if (saveStatus === "offline" || saveStatus === "unsynced") {
        set({ saveStatus: "saved" });
      }
      return;
    }

    set({ saveStatus: "syncing" });

    let hadError = false;

    for (const script of unsynced) {
      const { error } = await supabase.from("scripts").upsert({
        id: script.id,
        user_id: activeUserId,
        title: script.title || "Untitled Script",
        blocks: script.blocks,
        updated_at: script.updatedAt,
      });

      if (error) {
        hadError = true;
        continue;
      }

      await cacheScript({
        ...script,
        userId: activeUserId,
        unsynced: false,
      });
    }

    set({ saveStatus: hadError ? "failed" : "saved" });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    get().clearAuth();
  },
}));
