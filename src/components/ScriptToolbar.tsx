import {
  ArrowLeft,
  Download,
  FilePlus2,
  FileText,
  LayoutGrid,
  PanelsLeftRight,
  Save,
  Settings2,
  Users,
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
  onToggleTitlePage: () => void;
  isTitlePageVisible: boolean;
  onOpenExportSettings: () => void;
  onPrint: () => void;
  onOpenFormatSettings: () => void;
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
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition ${
        active
          ? "border-blue-300 bg-blue-50 text-blue-900"
          : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100"
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
  onToggleTitlePage,
  isTitlePageVisible,
  onOpenExportSettings,
  onPrint,
  onOpenFormatSettings,
}: ScriptToolbarProps) {
  return (
    <div className="border-b border-zinc-300 bg-zinc-100/95 backdrop-blur">
      <div
        className="mx-auto flex min-h-[56px] w-full max-w-[1600px] items-center gap-3 overflow-x-auto px-3 py-2 sm:px-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-fit flex-1 items-center gap-2">
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

        <div className="flex min-w-fit flex-1 items-center justify-center gap-2">
          <ToolbarButton
            label={isTitlePageVisible ? "Hide Title Page" : "Show Title Page"}
            icon={FileText}
            onClick={onToggleTitlePage}
            active={isTitlePageVisible}
          />
          <select
            title="Element Type"
            value={activeElementType}
            onChange={(event) =>
              onChangeElementType(event.target.value as ScriptBlock["type"])
            }
            className="h-8 w-32 rounded-md border border-zinc-300 bg-white px-2 text-xs text-zinc-800"
          >
            <option value="scene">Scene</option>
            <option value="action">Action</option>
            <option value="character">Character</option>
            <option value="dialogue">Dialogue</option>
          </select>
          <ToolbarButton
            label="Format"
            icon={Settings2}
            onClick={onOpenFormatSettings}
          />
        </div>

        <div className="flex min-w-fit flex-1 items-center justify-end gap-1.5">
          <ToolbarButton
            label="Export"
            icon={Download}
            onClick={onOpenExportSettings}
          />
          <ToolbarButton
            label="Print"
            icon={Download}
            onClick={onPrint}
          />
          <ToolbarButton
            label="Collaboration"
            icon={Users}
            onClick={() => undefined}
            disabled
            titleOverride="Collaboration (Coming soon)"
          />
          <ToolbarButton
            label="Split"
            icon={PanelsLeftRight}
            onClick={() => undefined}
            disabled
            titleOverride="Split (Coming soon)"
          />
          <ToolbarButton
            label="Beat Board"
            icon={LayoutGrid}
            onClick={() => undefined}
            disabled
            titleOverride="Beat Board (Coming soon)"
          />
          <div className="rounded border border-zinc-200 bg-white px-2 py-1">
            <SaveStatus />
          </div>
        </div>
      </div>
    </div>
  );
}
