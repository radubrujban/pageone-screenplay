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
  isPageViewActive: boolean;
  collaborationDisabled?: boolean;
  splitDisabled?: boolean;
  beatBoardDisabled?: boolean;
  feedbackDisabled?: boolean;
};

type ToolbarButtonProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  compact?: boolean;
  titleOverride?: string;
};

function ToolbarButton({
  label,
  icon: Icon,
  active = false,
  disabled = false,
  onClick,
  compact = false,
  titleOverride,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={titleOverride ?? label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      className={`flex items-center justify-center rounded-md border border-transparent transition ${
        active
          ? "bg-blue-50 text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-200/80 hover:text-zinc-900"
      } ${
        compact
          ? "h-8 w-8"
          : "h-8 gap-1 px-2.5 text-xs font-medium"
      } disabled:cursor-not-allowed disabled:text-zinc-400`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!compact && <span>{label}</span>}
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
  isPageViewActive,
  collaborationDisabled = true,
  splitDisabled = true,
  beatBoardDisabled = true,
  feedbackDisabled = true,
}: ScriptToolbarProps) {
  return (
    <div className="border-b border-zinc-300 bg-zinc-100">
      <div
        className="flex h-13 items-center gap-2 overflow-x-auto px-3 sm:px-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-0.5 rounded-md border border-zinc-300 bg-zinc-50 p-0.5">
          <ToolbarButton
            label="Collaboration"
            icon={Users}
            onClick={onCollaboration}
            disabled={collaborationDisabled}
            titleOverride="Collaboration (Coming soon)"
            compact
          />
          <ToolbarButton
            label="Split"
            icon={PanelsLeftRight}
            onClick={onSplit}
            disabled={splitDisabled}
            titleOverride="Split (Coming soon)"
            compact
          />
          <ToolbarButton
            label="Views"
            icon={PanelsTopLeft}
            onClick={onViews}
            active={isPageViewActive}
            titleOverride={
              isPageViewActive
                ? "Views (Page View active)"
                : "Views (Normal View active)"
            }
            compact
          />
          <ToolbarButton
            label="Beat Board"
            icon={LayoutGrid}
            onClick={onBeatBoard}
            disabled={beatBoardDisabled}
            titleOverride="Beat Board (Coming soon)"
            compact
          />
        </div>

        <div className="mx-auto flex min-w-[260px] items-center gap-2 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5">
          <div className="min-w-0 max-w-[220px] flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900">
              {title || "Untitled Script"}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              {isPageViewActive ? "Page View" : "Normal View"}
            </p>
          </div>
          <select
            title="Element Type"
            value={activeElementType}
            onChange={(event) =>
              onChangeElementType(event.target.value as ScriptBlock["type"])
            }
            className="h-7 w-32 rounded border border-zinc-300 bg-zinc-50 px-2 text-xs text-zinc-800"
          >
            <option value="scene">Scene</option>
            <option value="action">Action</option>
            <option value="character">Character</option>
            <option value="dialogue">Dialogue</option>
          </select>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 rounded-md border border-zinc-300 bg-zinc-50 p-0.5">
          <ToolbarButton
            label="Title Page"
            icon={FileText}
            onClick={onTitlePage}
          />
          <ToolbarButton
            label="Stats"
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
            disabled={feedbackDisabled}
            titleOverride="Feedback (Coming soon)"
          />
          <div className="ml-1 rounded border border-zinc-200 bg-white px-2 py-1">
            <SaveStatus />
          </div>
        </div>
      </div>
    </div>
  );
}
