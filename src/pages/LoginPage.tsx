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
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  const navigate = useNavigate();
  const { setUserId } = useScriptStore();

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
    <main className="min-h-screen bg-zinc-950 px-4 py-4 text-white sm:px-6 sm:py-8">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-2xl md:min-h-[calc(100vh-4rem)] md:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-6 md:border-b-0 md:border-r md:px-10 md:py-8">
          <div>
            <div className="mb-10 flex items-center gap-3 md:mb-16">
              <div className="flex h-10 w-10 items-center justify-center rounded border border-zinc-700 bg-zinc-950 font-mono text-sm font-bold">
                SP
              </div>
              <div>
                <p className="text-sm font-bold tracking-wide">Screenplay Pro</p>
                <p className="text-xs text-zinc-500">Professional script workspace</p>
              </div>
            </div>

            <p className="mb-4 text-xs font-bold uppercase tracking-[0.28em] text-blue-300">
              Write with structure
            </p>
            <h1 className="max-w-xl text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
              A focused writing room for screenplays in progress.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-zinc-400">
              Format scenes, shape dialogue, manage revisions, and keep your scripts
              ready for the next draft.
            </p>
          </div>

          <div className="mt-10 grid gap-3 text-sm text-zinc-400 sm:grid-cols-3 md:mt-12 md:grid-cols-1 lg:grid-cols-3">
            <div className="border-t border-zinc-800 pt-4">
              <p className="font-bold text-zinc-200">Industry rhythm</p>
              <p className="mt-1 text-xs leading-5">Scene, action, character, dialogue.</p>
            </div>
            <div className="border-t border-zinc-800 pt-4">
              <p className="font-bold text-zinc-200">Cloud library</p>
              <p className="mt-1 text-xs leading-5">Your drafts stay organized.</p>
            </div>
            <div className="border-t border-zinc-800 pt-4">
              <p className="font-bold text-zinc-200">Export ready</p>
              <p className="mt-1 text-xs leading-5">PDF, FDX, Fountain, RTF, TXT.</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center bg-zinc-950 px-5 py-7 sm:px-6 sm:py-10">
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Sign in to open your script library, or create an account to start a
                new draft.
              </p>
            </div>

            {message && (
              <div
                className={`mb-5 rounded border px-4 py-3 text-sm ${
                  messageType === "error"
                    ? "border-red-900/60 bg-red-950/40 text-red-200"
                    : "border-green-900/60 bg-green-950/40 text-green-200"
                }`}
              >
                {message}
              </div>
            )}

            {isOffline && !message && (
              <div className="mb-5 rounded border border-amber-900/60 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
                You’re offline. Reconnect to sign in, or reopen after logging in
                once online.
              </div>
            )}

            <label className="mb-4 block text-sm font-medium text-zinc-300">
              Email
              <input
                className="mt-2 w-full rounded border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="writer@example.com"
                type="email"
                value={email}
                disabled={isLoading || isOffline}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="mb-6 block text-sm font-medium text-zinc-300">
              Password
              <input
                className="mt-2 w-full rounded border border-zinc-800 bg-zinc-900 px-4 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
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
                className="w-full rounded bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-blue-200"
              >
                {authAction === "login" ? "Signing in..." : "Sign In"}
              </button>

              <button
                onClick={handleSignUp}
                disabled={isLoading || isOffline}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-bold text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {authAction === "signup" ? "Creating account..." : "Create Account"}
              </button>
            </div>

            <p className="mt-6 text-center text-xs leading-5 text-zinc-500">
              Built for clean drafts, calm revisions, and exportable scripts.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
