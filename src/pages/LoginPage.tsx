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

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      setAuthAction(null);
      return;
    }

    setMessageType("success");
    setMessage("Check your email to confirm your account.");
    setAuthAction(null);
  }

  const isLoading = authAction !== null;

  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#fffaf5_0%,#fff7ef_45%,#fff8f1_100%)] px-4 py-8 text-zinc-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col items-center justify-center">
        <p className="text-lg font-semibold tracking-[0.16em] text-zinc-700">PageOne</p>

        <div className="mt-8 text-center">
          <h1 className="text-3xl font-semibold text-zinc-900 sm:text-4xl">
            Write something real.
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-zinc-600">
            A quiet space for scripts, scenes, and first drafts.
          </p>
          <p className="mt-2 text-sm font-medium tracking-[0.04em] text-zinc-500">
            No AI. No noise. Just your words.
          </p>
        </div>

        <section
          className={`mt-10 w-full max-w-md rounded-2xl border border-[#f3d9c7] bg-white/95 p-6 shadow-[0_14px_38px_rgba(172,118,78,0.15)] transition-all duration-300 sm:p-7 ${
            cardVisible ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-[0.99] opacity-0"
          }`}
        >
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-zinc-900">Welcome</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Sign in to continue, or create an account to start your first draft.
            </p>
          </div>

          {message && (
            <div
              className={`mb-5 rounded-lg px-4 py-3 text-sm ${
                messageType === "error"
                  ? "border border-rose-200 bg-rose-50/80 text-rose-700"
                  : "border border-emerald-200 bg-emerald-50/80 text-emerald-700"
              }`}
              aria-live="polite"
            >
              {message}
            </div>
          )}

          {isOffline && !message && (
            <div
              className="mb-5 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800"
              aria-live="polite"
            >
              You’re offline. Reconnect to sign in, or reopen after logging in
              once online.
            </div>
          )}

          <label className="mb-4 block text-sm font-medium text-zinc-700">
            Email
            <input
              className="mt-2 w-full rounded-lg border border-[#e9d8cc] bg-white px-4 py-3 text-zinc-900 outline-none transition-all duration-150 placeholder:text-zinc-400 focus:border-[#ee9b63] focus:ring-2 focus:ring-[#f3c19f]/70 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
              placeholder="writer@example.com"
              type="email"
              value={email}
              disabled={isLoading || isOffline}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="mb-6 block text-sm font-medium text-zinc-700">
            Password
            <input
              className="mt-2 w-full rounded-lg border border-[#e9d8cc] bg-white px-4 py-3 text-zinc-900 outline-none transition-all duration-150 placeholder:text-zinc-400 focus:border-[#ee9b63] focus:ring-2 focus:ring-[#f3c19f]/70 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
              placeholder="Your password"
              type="password"
              value={password}
              disabled={isLoading || isOffline}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <div className="space-y-3">
            <button
              onClick={handleLogin}
              disabled={isLoading || isOffline}
              className="w-full rounded-lg bg-[#ee9b63] px-4 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#e28b51] disabled:cursor-not-allowed disabled:bg-[#efc4a7] disabled:text-white/90"
            >
              {authAction === "login" ? "Signing in..." : "Sign In"}
            </button>

            <button
              onClick={handleSignUp}
              disabled={isLoading || isOffline}
              className="w-full rounded-lg border border-[#edc7ad] bg-transparent px-4 py-3 text-sm font-semibold text-zinc-700 transition-colors duration-150 hover:bg-[#fff4eb] disabled:cursor-not-allowed disabled:text-zinc-400"
            >
              {authAction === "signup" ? "Creating account..." : "Create Account"}
            </button>
          </div>

          <p className="mt-6 text-center text-xs leading-5 text-zinc-500">
            Built for calm drafts and honest revisions.
          </p>
        </section>
      </div>
    </main>
  );
}
