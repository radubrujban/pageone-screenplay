import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useScriptStore } from "../store/useScriptStore";

export default function HomeRedirect() {
  const navigate = useNavigate();
  const authReady = useScriptStore((state) => state.authReady);
  const session = useScriptStore((state) => state.session);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (session) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [authReady, session, navigate]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      Loading...
    </div>
  );
}
