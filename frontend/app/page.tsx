"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "../lib/api";
import { setAccessToken } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("student.software@isu.local");
  const [password, setPassword] = useState("DevPassword123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await login(email, password);
      setAccessToken(data.accessToken);
      router.push("/chat");
    } catch {
      setError("Login failed. Check credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
        <form
          onSubmit={onSubmit}
          className="w-full rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl"
        >
          <h1 className="mb-6 text-2xl font-semibold">IsuChat Login</h1>
          <label className="mb-4 block">
            <span className="mb-2 block text-sm text-slate-300">Email</span>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-400 focus:ring-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </label>
          <label className="mb-5 block">
            <span className="mb-2 block text-sm text-slate-300">Password</span>
            <input
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none ring-cyan-400 focus:ring-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </label>
          {error ? <p className="mb-4 text-sm text-rose-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-500 px-4 py-2 font-medium text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </main>
  );
}
