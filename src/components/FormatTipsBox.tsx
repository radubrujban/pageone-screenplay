import type { ScriptBlock } from "../types/script";

type TipContent = {
  title: string;
  description: string;
  example: string;
};

const TIP_CONTENT: Record<
  "scene_heading" | "action" | "character" | "parenthetical" | "dialogue" | "transition" | "shot" | "general",
  TipContent
> = {
  scene_heading: {
    title: "Scene Heading",
    description:
      "Used to establish where and when a scene takes place.",
    example: "INT. APARTMENT - NIGHT",
  },
  action: {
    title: "Action",
    description:
      "Used to describe what the audience sees and hears.",
    example: "Rain taps against the window.",
  },
  character: {
    title: "Character",
    description: "Used to identify who is speaking.",
    example: "MAYA",
  },
  parenthetical: {
    title: "Parenthetical",
    description:
      "Used for brief delivery direction inside dialogue.",
    example: "(whispering)",
  },
  dialogue: {
    title: "Dialogue",
    description: "Used for spoken lines.",
    example: "I thought you left.",
  },
  transition: {
    title: "Transition",
    description: "Used to indicate an editorial transition.",
    example: "CUT TO:",
  },
  shot: {
    title: "Shot",
    description:
      "Used sparingly to call out a specific camera or view emphasis.",
    example: "CLOSE ON: The cracked photograph.",
  },
  general: {
    title: "General",
    description: "Fallback plain text for notes or unclassified writing.",
    example: "This needs revision.",
  },
};

function normalizeType(type: ScriptBlock["type"]) {
  return type === "scene" ? "scene_heading" : type;
}

type FormatTipsBoxProps = {
  activeType: ScriptBlock["type"];
  onClose: () => void;
};

export default function FormatTipsBox({
  activeType,
  onClose,
}: FormatTipsBoxProps) {
  const tip = TIP_CONTENT[normalizeType(activeType)];

  return (
    <aside className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Tip
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
        >
          Close
        </button>
      </div>

      <h3 className="mt-3 text-sm font-semibold text-zinc-900">{tip.title}</h3>
      <p className="mt-1 text-sm leading-6 text-zinc-600">{tip.description}</p>

      <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
          Example
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-800">{tip.example}</p>
      </div>
    </aside>
  );
}
