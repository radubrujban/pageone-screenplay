import { useScriptStore } from "../store/useScriptStore";
import type { SaveStatusValue } from "../store/useScriptStore";

const labels: Record<SaveStatusValue, string> = {
  saved: "Saved",
  syncing: "Syncing...",
  failed: "Save failed",
  unsynced: "Unsynced",
  offline: "Offline",
};

const colors: Record<SaveStatusValue, string> = {
  saved: "text-green-600",
  syncing: "text-yellow-600",
  failed: "text-red-600",
  unsynced: "text-yellow-600",
  offline: "text-red-600",
};

export default function SaveStatus({ className = "" }: { className?: string }) {
  const saveStatus = useScriptStore((state) => state.saveStatus);

  return (
    <span className={`text-xs font-bold ${colors[saveStatus]} ${className}`}>
      {labels[saveStatus]}
    </span>
  );
}
