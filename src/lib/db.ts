import Dexie from "dexie";
import type { ScriptBlock } from "../types/script";

export interface Script {
  id: string;
  title: string;
  blocks: ScriptBlock[];
  updatedAt: number;
}

class ScriptDatabase extends Dexie {
  scripts!: Dexie.Table<Script, string>;

  constructor() {
    super("ScriptDatabase");

    this.version(1).stores({
      scripts: "id, title, updatedAt",
    });
  }
}

export const db = new ScriptDatabase();