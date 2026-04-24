import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6">
      <h1 className="text-7xl font-bold mb-6">
        Screenplay Pro
      </h1>

      <p className="text-xl text-zinc-400 text-center max-w-2xl mb-10">
        Professional screenwriting software built for creators.
      </p>

      <Link
        to="/login"
        className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-lg transition"
      >
        Get Started
      </Link>
    </main>
  );
}