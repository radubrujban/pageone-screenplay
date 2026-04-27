import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type AppLayoutProps = {
  children: ReactNode;
  contentClassName?: string;
};

type UpdateAvailableEventDetail = {
  updateServiceWorker?: (reloadPage?: boolean) => Promise<void>;
  detectedAt?: number;
};

const UPDATE_IDLE_MS = 30_000;
const APPLY_POLL_MS = 2_000;
const RELOAD_FALLBACK_MS = 1_500;
const UPDATE_LOOP_GUARD_MS = 120_000;
const UPDATE_APPLIED_SESSION_KEY = "pageone:update-applied";

function isTypingSurface(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") return true;
  if (element.isContentEditable) return true;
  return element.closest("[contenteditable='true']") !== null;
}

export default function AppLayout({
  children,
  contentClassName = "",
}: AppLayoutProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const updateServiceWorkerRef = useRef<
    ((reloadPage?: boolean) => Promise<void>) | null
  >(null);
  const updateAvailableRef = useRef(false);
  const updateDetectedAtRef = useRef<number | null>(null);
  const lastAppliedDetectedAtRef = useRef<number | null>(null);
  const isApplyingUpdateRef = useRef(false);
  const lastActivityRef = useRef(0);
  const editableBlurredSinceUpdateRef = useRef(false);
  const loopGuardUntilRef = useRef(0);

  useEffect(() => {
    updateAvailableRef.current = updateAvailable;
  }, [updateAvailable]);

  const maybeApplyUpdate = useCallback(async (trigger: string) => {
    if (isApplyingUpdateRef.current) return;
    if (!updateAvailableRef.current) return;
    if (!navigator.onLine) return;
    if (Date.now() < loopGuardUntilRef.current) return;

    const updateServiceWorker = updateServiceWorkerRef.current;
    if (!updateServiceWorker) return;

    const detectedAt = updateDetectedAtRef.current;
    if (
      detectedAt !== null &&
      lastAppliedDetectedAtRef.current === detectedAt
    ) {
      return;
    }

    const activeElement = document.activeElement;
    const isEditingFocused = isTypingSurface(activeElement);
    const idleForMs = Date.now() - lastActivityRef.current;
    const hasBeenIdle = idleForMs >= UPDATE_IDLE_MS;

    const safeToUpdate = isEditingFocused
      ? editableBlurredSinceUpdateRef.current || hasBeenIdle
      : hasBeenIdle;

    if (!safeToUpdate) return;

    isApplyingUpdateRef.current = true;
    editableBlurredSinceUpdateRef.current = false;
    lastAppliedDetectedAtRef.current = detectedAt ?? Date.now();

    const appliedAt = Date.now();
    sessionStorage.setItem(UPDATE_APPLIED_SESSION_KEY, String(appliedAt));
    loopGuardUntilRef.current = appliedAt + UPDATE_LOOP_GUARD_MS;

    setUpdateAvailable(false);
    updateAvailableRef.current = false;

    console.info(`[PWA] Applying update (${trigger})`);

    try {
      await updateServiceWorker(true);
    } catch (error) {
      console.warn("[PWA] Update application failed; will retry.", error);
      isApplyingUpdateRef.current = false;
      setUpdateAvailable(true);
      updateAvailableRef.current = true;
      return;
    }

    window.setTimeout(() => {
      if (!navigator.onLine) return;
      window.location.reload();
    }, RELOAD_FALLBACK_MS);
  }, []);

  useEffect(() => {
    const previousApply = sessionStorage.getItem(UPDATE_APPLIED_SESSION_KEY);
    if (!previousApply) return;

    const appliedAt = Number(previousApply);
    if (!Number.isFinite(appliedAt)) {
      sessionStorage.removeItem(UPDATE_APPLIED_SESSION_KEY);
      return;
    }

    const guardUntil = appliedAt + UPDATE_LOOP_GUARD_MS;
    if (guardUntil <= Date.now()) {
      sessionStorage.removeItem(UPDATE_APPLIED_SESSION_KEY);
      return;
    }

    loopGuardUntilRef.current = guardUntil;

    const clearAfterMs = guardUntil - Date.now();
    const clearGuardTimeout = window.setTimeout(() => {
      if (sessionStorage.getItem(UPDATE_APPLIED_SESSION_KEY) === previousApply) {
        sessionStorage.removeItem(UPDATE_APPLIED_SESSION_KEY);
      }
      if (Date.now() >= loopGuardUntilRef.current) {
        loopGuardUntilRef.current = 0;
      }
    }, clearAfterMs);

    return () => {
      window.clearTimeout(clearGuardTimeout);
    };
  }, []);

  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    function markActivity() {
      lastActivityRef.current = Date.now();
    }

    window.addEventListener("keydown", markActivity, true);
    window.addEventListener("input", markActivity, true);
    window.addEventListener("pointerdown", markActivity, true);

    return () => {
      window.removeEventListener("keydown", markActivity, true);
      window.removeEventListener("input", markActivity, true);
      window.removeEventListener("pointerdown", markActivity, true);
    };
  }, []);

  useEffect(() => {
    function handleUpdateAvailable(event: Event) {
      const updateEvent = event as CustomEvent<UpdateAvailableEventDetail>;

      if (updateEvent.detail?.updateServiceWorker) {
        updateServiceWorkerRef.current = updateEvent.detail.updateServiceWorker;
      }
      updateDetectedAtRef.current = updateEvent.detail?.detectedAt ?? Date.now();
      editableBlurredSinceUpdateRef.current = false;
      setUpdateAvailable(true);
      updateAvailableRef.current = true;

      void maybeApplyUpdate("need-refresh");
    }

    window.addEventListener("pageone:pwa-update-available", handleUpdateAvailable);
    return () => {
      window.removeEventListener(
        "pageone:pwa-update-available",
        handleUpdateAvailable
      );
    };
  }, [maybeApplyUpdate]);

  useEffect(() => {
    async function handleApplyUpdateRequest() {
      editableBlurredSinceUpdateRef.current = true;
      void maybeApplyUpdate("manual-event");
    }

    window.addEventListener("pageone:apply-pwa-update", handleApplyUpdateRequest);
    return () => {
      window.removeEventListener(
        "pageone:apply-pwa-update",
        handleApplyUpdateRequest
      );
    };
  }, [maybeApplyUpdate]);

  useEffect(() => {
    if (!updateAvailable) return;

    function handleEditableBlur(event: FocusEvent) {
      if (!isTypingSurface(event.target as Element | null)) return;
      editableBlurredSinceUpdateRef.current = true;
      void maybeApplyUpdate("blur");
    }

    function handleOnline() {
      void maybeApplyUpdate("online");
    }

    const applyInterval = window.setInterval(() => {
      void maybeApplyUpdate("idle-poll");
    }, APPLY_POLL_MS);
    const initialApplyTimeout = window.setTimeout(() => {
      void maybeApplyUpdate("update-available");
    }, 0);

    window.addEventListener("focusout", handleEditableBlur, true);
    window.addEventListener("online", handleOnline);

    return () => {
      window.clearTimeout(initialApplyTimeout);
      window.clearInterval(applyInterval);
      window.removeEventListener("focusout", handleEditableBlur, true);
      window.removeEventListener("online", handleOnline);
    };
  }, [maybeApplyUpdate, updateAvailable]);

  return (
    <div
      className="min-h-screen bg-zinc-100 text-zinc-950"
      data-pwa-update-available={updateAvailable ? "true" : "false"}
    >
      <main
        className={`mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 ${contentClassName}`}
      >
        {children}
      </main>
    </div>
  );
}
