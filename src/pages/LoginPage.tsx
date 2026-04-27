import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { useScriptStore } from "../store/useScriptStore";

type AuthAction = "login" | "signup" | null;

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authAction, setAuthAction] = useState<AuthAction>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [cardVisible, setCardVisible] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  const navigate = useNavigate();
  const { setUserId } = useScriptStore();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCardVisible(true));
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    function handleOffline() {
      setIsOffline(true);
    }

    function handleOnline() {
      setIsOffline(false);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  async function handleLogin() {
    if (isOffline) {
      setMessageType("error");
      setMessage(
        "You’re offline. Reconnect to sign in, or reopen after logging in once online."
      );
      return;
    }

    setAuthAction("login");
    setMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setAuthAction(null);
      return;
    }

    setUserId(data.user?.id || null);

    navigate("/dashboard");
  }

  async function handleSignUp() {
    if (isOffline) {
      setMessageType("error");
      setMessage(
        "You’re offline. Reconnect to sign in, or reopen after logging in once online."
      );
      return;
    }

    setAuthAction("signup");
    setMessage("");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setAuthAction(null);
      return;
    }

    if (data.session?.user?.id) {
      setUserId(data.session.user.id);
      navigate("/dashboard");
      return;
    }

    setMessageType("success");
    setMessage("Check your email to confirm your account.");
    setAuthAction(null);
  }

  const isLoading = authAction !== null;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#fbf8f2] px-4 py-8 text-zinc-950 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col">
        <div className="flex items-center justify-between border-b border-zinc-300 pb-4">
          <p className="text-[9px] font-medium uppercase tracking-[0.28em] text-zinc-500">
            PageOne
          </p>
          <p className="text-[9px] font-medium uppercase tracking-[0.28em] text-zinc-500">
            entry
          </p>
        </div>

        <section className="grid flex-1 gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-16 lg:py-14">
          <div className="lg:pt-4">
            <h1 className="max-w-4xl text-[3.4rem] font-medium lowercase leading-[0.86] text-zinc-950 sm:text-[5.2rem] lg:text-[7.2rem]">
              write something.
            </h1>
          </div>

          <section
            className={`w-full border border-zinc-300 bg-[#fcfaf6] p-5 transition-all duration-300 sm:p-6 ${
              cardVisible
                ? "translate-y-0 scale-100 opacity-100"
                : "translate-y-1 scale-[0.995] opacity-0"
            }`}
          >
            {message && (
              <div
                className={`mb-5 border px-3 py-2 text-xs leading-6 ${
                  messageType === "error"
                    ? "border-rose-300 text-rose-700"
                    : "border-emerald-300 text-emerald-700"
                }`}
                aria-live="polite"
              >
                {message}
              </div>
            )}

            {isOffline && !message && (
              <div
                className="mb-5 border border-amber-300 px-3 py-2 text-xs leading-6 text-amber-800"
                aria-live="polite"
              >
                You’re offline. Reconnect to sign in, or reopen after logging in
                once online.
              </div>
            )}

            <label className="mb-4 block text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-600">
              Email
              <input
                className="mt-2 w-full border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                placeholder="writer@example.com"
                type="email"
                value={email}
                disabled={isLoading || isOffline}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="mb-6 block text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-600">
              Password
              <input
                className="mt-2 w-full border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                placeholder="Your password"
                type="password"
                value={password}
                disabled={isLoading || isOffline}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <div className="space-y-2.5">
              <button
                onClick={handleLogin}
                disabled={isLoading || isOffline}
                className="w-full border border-zinc-900 bg-zinc-900 px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-[#fbf8f2] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-400 disabled:bg-zinc-400 disabled:text-zinc-100"
              >
                {authAction === "login" ? "Signing in..." : "Sign In"}
              </button>

              <button
                onClick={handleSignUp}
                disabled={isLoading || isOffline}
                className="w-full border border-zinc-300 bg-transparent px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-700 transition hover:border-zinc-900 hover:text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
              >
                {authAction === "signup" ? "Creating account..." : "Create Account"}
              </button>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
