import {
  ArrowLeft,
  Download,
  FilePlus2,
  Lightbulb,
  Printer,
  Save,
} from "lucide-react";
import type { ComponentType } from "react";
import SaveStatus from "./SaveStatus";
import type { ScriptBlock } from "../types/script";

type ScriptToolbarProps = {
  activeElementType: ScriptBlock["type"];
  onChangeElementType: (type: ScriptBlock["type"]) => void;
  onBackToDashboard: () => void;
  onNewScript: () => void;
  onSaveNow: () => void;
  onOpenExportSettings: () => void;
  onPrint: () => void;
  showFormatTips: boolean;
  onToggleFormatTips: () => void;
};

type ToolbarButtonProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  titleOverride?: string;
};

function ToolbarButton({
  label,
  icon: Icon,
  onClick,
  active = false,
  disabled = false,
  titleOverride,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={titleOverride ?? label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/70 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-50 ${
        active
          ? "border-zinc-300 bg-zinc-100 text-zinc-800"
          : "border-zinc-300 bg-white/95 text-zinc-700 hover:bg-zinc-100/80"
      } disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

export default function ScriptToolbar({
  activeElementType,
  onChangeElementType,
  onBackToDashboard,
  onNewScript,
  onSaveNow,
  onOpenExportSettings,
  onPrint,
  showFormatTips,
  onToggleFormatTips,
}: ScriptToolbarProps) {
  const selectedElementType =
    activeElementType === "scene" ? "scene_heading" : activeElementType;

  return (
    <div className="border-b border-zinc-200/90 bg-zinc-50/95 backdrop-blur-sm">
      <div
        className="mx-auto grid min-h-[58px] w-full max-w-[1600px] grid-cols-1 items-center gap-2 px-3 py-2.5 sm:px-4 lg:grid-cols-[1fr_auto_1fr] lg:gap-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 items-center gap-2">
          <ToolbarButton
            label="Back"
            icon={ArrowLeft}
            onClick={onBackToDashboard}
          />
          <ToolbarButton
            label="New"
            icon={FilePlus2}
            onClick={onNewScript}
          />
          <ToolbarButton
            label="Save"
            icon={Save}
            onClick={onSaveNow}
          />
        </div>

        <div className="flex min-w-0 items-center justify-start gap-2 lg:justify-center">
          <select
            title="Element Type"
            value={selectedElementType}
            onChange={(event) =>
              onChangeElementType(event.target.value as ScriptBlock["type"])
            }
            className="h-8 w-40 rounded-md border border-zinc-300 bg-white/95 px-2 text-xs text-zinc-800 outline-none transition-colors focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-50"
          >
            <option value="scene_heading">Scene Heading</option>
            <option value="action">Action</option>
            <option value="character">Character</option>
            <option value="parenthetical">Parenthetical</option>
            <option value="dialogue">Dialogue</option>
            <option value="transition">Transition</option>
            <option value="shot">Shot</option>
            <option value="general">General</option>
          </select>
          <ToolbarButton
            label="Tips"
            icon={Lightbulb}
            onClick={onToggleFormatTips}
            active={showFormatTips}
          />
        </div>

        <div className="flex min-w-0 items-center justify-start gap-2 lg:justify-end">
          <ToolbarButton
            label="Export"
            icon={Download}
            onClick={onOpenExportSettings}
          />
          <ToolbarButton
            label="Print"
            icon={Printer}
            onClick={onPrint}
          />
          <SaveStatus className="ml-1 whitespace-nowrap text-[11px]" />
        </div>
      </div>
    </div>
  );
}
