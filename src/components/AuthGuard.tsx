import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useScriptStore } from "../store/useScriptStore";

export default function AuthGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const authReady = useScriptStore((state) => state.authReady);
  const session = useScriptStore((state) => state.session);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!session) {
      navigate("/login", { replace: true });
    }
  }, [authReady, session, navigate]);

  if (!authReady || !session) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}
