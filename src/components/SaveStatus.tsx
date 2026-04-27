import { useScriptStore } from "../store/useScriptStore";
import type { SaveStatusValue } from "../store/useScriptStore";

const labels: Record<SaveStatusValue, string> = {
  saved: "All changes saved",
  syncing: "Saving...",
  failed: "Save failed",
  unsynced: "Not synced yet",
  offline: "Working offline",
};

const textColors: Record<SaveStatusValue, string> = {
  saved: "text-zinc-500",
  syncing: "text-zinc-600",
  failed: "text-red-600",
  unsynced: "text-zinc-600",
  offline: "text-zinc-500",
};

const dotColors: Record<SaveStatusValue, string> = {
  saved: "bg-emerald-500",
  syncing: "bg-amber-500",
  failed: "bg-red-500",
  unsynced: "bg-amber-500",
  offline: "bg-zinc-400",
};

export default function SaveStatus({ className = "" }: { className?: string }) {
  const saveStatus = useScriptStore((state) => state.saveStatus);

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${textColors[saveStatus]} ${className}`}
      aria-live="polite"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${dotColors[saveStatus]}`}
        aria-hidden
      />
      {labels[saveStatus]}
    </span>
  );
}
