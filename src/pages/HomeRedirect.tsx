import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useScriptStore } from "../store/useScriptStore";

export default function HomeRedirect() {
  const navigate = useNavigate();
  const authReady = useScriptStore((state) => state.authReady);
  const userId = useScriptStore((state) => state.userId);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (userId) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/login", { replace: true });
    }
  }, [authReady, userId, navigate]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      Loading...
    </div>
  );
}
