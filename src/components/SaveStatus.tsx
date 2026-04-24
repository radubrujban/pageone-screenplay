import { useEffect } from "react";
import { useScriptStore } from "../store/useScriptStore";
import type { SaveStatusValue } from "../store/useScriptStore";

const labels: Record<SaveStatusValue, string> = {
  saved: "Saved",
  saving: "Saving...",
  failed: "Save failed",
  unsynced: "Unsynced",
  offline: "Offline",
};

const colors: Record<SaveStatusValue, string> = {
  saved: "text-green-600",
  saving: "text-yellow-600",
  failed: "text-red-600",
  unsynced: "text-yellow-600",
  offline: "text-red-600",
};

export default function SaveStatus({ className = "" }: { className?: string }) {
  const { saveStatus, setSaveStatus } = useScriptStore();

  useEffect(() => {
    function handleOffline() {
      setSaveStatus("offline");
    }

    function handleOnline() {
      setSaveStatus(saveStatus === "offline" ? "unsynced" : saveStatus);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [saveStatus, setSaveStatus]);

  return (
    <span className={`text-xs font-bold ${colors[saveStatus]} ${className}`}>
      {labels[saveStatus]}
    </span>
  );
}
