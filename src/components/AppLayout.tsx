import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

type AppLayoutProps = {
  children: ReactNode;
  contentClassName?: string;
};

export default function AppLayout({
  children,
  contentClassName = "",
}: AppLayoutProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const updateServiceWorkerRef = useRef<
    ((reloadPage?: boolean) => Promise<void>) | null
  >(null);

  useEffect(() => {
    function handleUpdateAvailable(event: Event) {
      const updateEvent = event as CustomEvent<{
        updateServiceWorker?: (reloadPage?: boolean) => Promise<void>;
      }>;

      if (updateEvent.detail?.updateServiceWorker) {
        updateServiceWorkerRef.current = updateEvent.detail.updateServiceWorker;
      }
      setUpdateAvailable(true);
    }

    window.addEventListener("pageone:pwa-update-available", handleUpdateAvailable);
    return () => {
      window.removeEventListener(
        "pageone:pwa-update-available",
        handleUpdateAvailable
      );
    };
  }, []);

  async function handleRefreshApp() {
    if (isRefreshing) return;
    setIsRefreshing(true);

    try {
      if (updateAvailable && updateServiceWorkerRef.current) {
        await updateServiceWorkerRef.current(true);
        return;
      }
      window.location.reload();
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <button
        type="button"
        onClick={handleRefreshApp}
        disabled={isRefreshing}
        title={
          updateAvailable
            ? "Update App"
            : "Refresh App"
        }
        className="fixed right-4 top-4 z-50 inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-sm backdrop-blur transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        {updateAvailable ? "Update App" : "Refresh App"}
      </button>

      <main
        className={`mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 ${contentClassName}`}
      >
        {children}
      </main>
    </div>
  );
}
