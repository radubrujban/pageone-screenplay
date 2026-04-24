import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function HomeRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getUser();

      if (data.user) {
        navigate("/dashboard");
      } else {
        navigate("/login");
      }
    }

    check();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
      Loading...
    </div>
  );
}
