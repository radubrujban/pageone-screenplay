export type BlockType = "scene" | "action" | "character" | "dialogue";

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