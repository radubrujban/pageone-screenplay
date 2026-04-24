import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useScriptStore } from "../store/useScriptStore";

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const authReady = useScriptStore((state) => state.authReady);
  const userId = useScriptStore((state) => state.userId);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!userId) {
      navigate("/login", { replace: true });
    }
  }, [authReady, userId, navigate]);

  if (!authReady || !userId) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
