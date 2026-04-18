"use client";

import { useState } from "react";
import { createClient } from "@/infrastructure/database/supabase/client";
import { useRouter } from "next/navigation";
import { Database } from "lucide-react";

export function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      router.push("/factory");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700">
        <div className="flex flex-col items-center">
          <Database className="w-12 h-12 text-blue-400 mb-4" />
          <h2 className="text-center text-3xl font-bold tracking-tight text-white">
            Data Factory Admin
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            Secure portal for PaperPilot administrators
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="block text-sm font-medium text-slate-300">Admin Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm placeholder-slate-400"
                placeholder="admin@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>

          {error && <div className="text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-md text-sm text-center font-medium">{error}</div>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2.5 px-4 text-sm font-bold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 transition-colors"
            >
              {loading ? "Authenticating..." : "Enter Factory"}
            </button>
          </div>
          <div className="text-center mt-4">
             <a href="/login" className="text-sm text-slate-400 hover:text-slate-300 transition-colors">
               ← Back to User Portal
             </a>
          </div>
        </form>
      </div>
    </div>
  );
}
