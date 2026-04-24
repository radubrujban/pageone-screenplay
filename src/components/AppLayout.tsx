import type { ReactNode } from "react";
import SaveStatus from "./SaveStatus";

type AppLayoutProps = {
  children: ReactNode;
  showSaveStatus?: boolean;
  contentClassName?: string;
};

export default function AppLayout({
  children,
  showSaveStatus = false,
  contentClassName = "",
}: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-zinc-50/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6">
          <span className="text-sm font-bold tracking-[0.08em] text-zinc-800">
            PageOne
          </span>
          {showSaveStatus ? <SaveStatus className="shrink-0" /> : <span />}
        </div>
      </header>

      <main
        className={`mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8 ${contentClassName}`}
      >
        {children}
      </main>
    </div>
  );
}
