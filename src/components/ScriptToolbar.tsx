import {
  BarChart3,
  Eye,
  FileText,
  LayoutGrid,
  ListTree,
  MessageCircle,
  PanelsLeftRight,
  PanelsTopLeft,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import SaveStatus from "./SaveStatus";
import type { ScriptBlock } from "../types/script";

type ScriptToolbarProps = {
  title: string;
  activeElementType: ScriptBlock["type"];
  onChangeElementType: (type: ScriptBlock["type"]) => void;
  onCollaboration: () => void;
  onSplit: () => void;
  onViews: () => void;
  onBeatBoard: () => void;
  onTitlePage: () => void;
  onWritingStats: () => void;
  onShowHide: () => void;
  onNavigator: () => void;
  onFeedback: () => void;
  isStatsActive: boolean;
  isShowHideActive: boolean;
  isNavigatorActive: boolean;
  isFeedbackActive: boolean;
  splitDisabled?: boolean;
  beatBoardDisabled?: boolean;
};

type ToolbarButtonProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function ToolbarButton({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      className={`flex h-12 min-w-[82px] flex-col items-center justify-center rounded-md border px-2 text-[11px] font-medium leading-tight transition ${
        active
          ? "border-zinc-300 bg-blue-50 text-zinc-900"
          : "border-transparent bg-transparent text-zinc-700 hover:border-zinc-200 hover:bg-zinc-100"
      } disabled:cursor-not-allowed disabled:text-zinc-400`}
    >
      <Icon className="mb-1 h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

export default function ScriptToolbar({
  title,
  activeElementType,
  onChangeElementType,
  onCollaboration,
  onSplit,
  onViews,
  onBeatBoard,
  onTitlePage,
  onWritingStats,
  onShowHide,
  onNavigator,
  onFeedback,
  isStatsActive,
  isShowHideActive,
  isNavigatorActive,
  isFeedbackActive,
  splitDisabled = true,
  beatBoardDisabled = true,
}: ScriptToolbarProps) {
  return (
    <div className="border-b border-zinc-200 bg-zinc-100/95">
      <div
        className="flex min-h-14 items-center gap-2 overflow-x-auto px-3 py-2 sm:px-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          <ToolbarButton
            label="Collaboration"
            icon={Users}
            onClick={onCollaboration}
          />
          <ToolbarButton
            label="Split"
            icon={PanelsLeftRight}
            onClick={onSplit}
            disabled={splitDisabled}
          />
          <ToolbarButton label="Views" icon={PanelsTopLeft} onClick={onViews} />
          <ToolbarButton
            label="Beat Board"
            icon={LayoutGrid}
            onClick={onBeatBoard}
            disabled={beatBoardDisabled}
          />
          <ToolbarButton
            label="Title Page"
            icon={FileText}
            onClick={onTitlePage}
          />
        </div>

        <div className="mx-1 flex min-w-[260px] items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 shadow-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900">
              {title || "Untitled Script"}
            </p>
          </div>
          <select
            value={activeElementType}
            onChange={(event) =>
              onChangeElementType(event.target.value as ScriptBlock["type"])
            }
            className="rounded-md border border-zinc-300 bg-zinc-50 px-2 py-1 text-xs text-zinc-800"
          >
            <option value="scene">Scene</option>
            <option value="action">Action</option>
            <option value="character">Character</option>
            <option value="dialogue">Dialogue</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <ToolbarButton
            label="Writing Stats"
            icon={BarChart3}
            onClick={onWritingStats}
            active={isStatsActive}
          />
          <ToolbarButton
            label="Show/Hide"
            icon={Eye}
            onClick={onShowHide}
            active={isShowHideActive}
          />
          <ToolbarButton
            label="Navigator"
            icon={ListTree}
            onClick={onNavigator}
            active={isNavigatorActive}
          />
          <ToolbarButton
            label="Feedback"
            icon={MessageCircle}
            onClick={onFeedback}
            active={isFeedbackActive}
          />
          <div className="ml-2 rounded-md border border-zinc-200 bg-white px-3 py-2">
            <SaveStatus />
          </div>
        </div>
      </div>
    </div>
  );
}
