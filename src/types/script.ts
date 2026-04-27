export type BlockType =
  | "scene_heading"
  | "action"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "transition"
  | "shot"
  | "general"
  | "scene"; // legacy alias for older cached/remote scripts

export type RevisionColor =
  | "none"
  | "blue"
  | "pink"
  | "yellow"
  | "green"
  | "orange";

export interface ScriptBlock {
  id: string;
  type: BlockType;
  text: string;
  note?: string;
  locked?: boolean;
  revisionColor?: RevisionColor;
}
