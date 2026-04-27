import Dexie from "dexie";
import type { ScriptBlock } from "../types/script";
import type { TitlePageData } from "./screenplayFormat";

export interface CachedScript {
  id: string;
  userId: string;
  title: string;
  blocks: ScriptBlock[];
  titlePage?: TitlePageData;
  updatedAt: number;
  unsynced: boolean;
}

class ScriptDatabase extends Dexie {
  scripts!: Dexie.Table<CachedScript, string>;

  constructor() {
    super("ScriptDatabase");

    this.version(1).stores({
      scripts: "id, title, updatedAt",
    });

    this.version(2)
      .stores({
        scripts: "id, userId, updatedAt, unsynced",
      })
      .upgrade((tx) =>
        tx
          .table("scripts")
          .toCollection()
          .modify((script: Record<string, unknown>) => {
            script.userId = typeof script.userId === "string" ? script.userId : "";
            script.unsynced = false;
          })
      );

    this.version(3)
      .stores({
        scripts: "id, userId, updatedAt, unsynced",
      })
      .upgrade((tx) =>
        tx
          .table("scripts")
          .toCollection()
          .modify((script: Record<string, unknown>) => {
            if (typeof script.titlePage !== "object" || script.titlePage === null) {
              script.titlePage = {
                title: typeof script.title === "string" ? script.title : "",
                writtenBy: "",
                basedOn: "",
                contact: "",
                draftDate: new Date().toLocaleDateString(),
              };
            }
          })
      );
  }
}

export const db = new ScriptDatabase();

export async function cacheScript(script: CachedScript) {
  await db.scripts.put(script);
}

export async function cacheRemoteScript(input: {
  id: string;
  userId: string;
  title?: string | null;
  blocks?: ScriptBlock[] | null;
  titlePage?: TitlePageData | null;
  updatedAt?: number;
}) {
  await cacheScript({
    id: input.id,
    userId: input.userId,
    title: input.title || "Untitled Script",
    blocks: input.blocks || [],
    titlePage: input.titlePage ?? {
      title: input.title || "Untitled Script",
      writtenBy: "",
      basedOn: "",
      contact: "",
      draftDate: new Date().toLocaleDateString(),
    },
    updatedAt: input.updatedAt ?? Date.now(),
    unsynced: false,
  });
}

export async function cacheRemoteScripts(
  userId: string,
  scripts: {
    id: string;
    title?: string | null;
    blocks?: ScriptBlock[] | null;
    updated_at?: number;
    title_page?: TitlePageData | null;
  }[]
) {
  if (scripts.length === 0) return;

  await db.scripts.bulkPut(
    scripts.map((script) => ({
      id: script.id,
      userId,
      title: script.title || "Untitled Script",
      blocks: script.blocks || [],
      titlePage: script.title_page ?? {
        title: script.title || "Untitled Script",
        writtenBy: "",
        basedOn: "",
        contact: "",
        draftDate: new Date().toLocaleDateString(),
      },
      updatedAt: script.updated_at ?? Date.now(),
      unsynced: false,
    }))
  );
}

export async function getCachedScript(id: string) {
  return db.scripts.get(id);
}

export async function getCachedScriptsByUser(userId: string) {
  const scripts = await db.scripts.where("userId").equals(userId).toArray();
  return scripts.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getUnsyncedScriptsByUser(userId: string) {
  return db.scripts
    .where("userId")
    .equals(userId)
    .and((script) => script.unsynced)
    .toArray();
}
