"use client";

import { useState } from "react";
import { createClient } from "@/infrastructure/database/supabase/client";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
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
      router.push("/");
      router.refresh();
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 1. Check if the email is already registered using our secure endpoint
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (!checkRes.ok) {
        setError("Failed to verify email availability. Please try again.");
        setLoading(false);
        return;
      }
      
      const { exists } = await checkRes.json();
      
      if (exists) {
        setError("This email address is already registered. Please sign in instead.");
        setLoading(false);
        return;
      }

      // 2. Proceed with Supabase sign up if email is available
      // Note: In Supabase, standard signUp will send the default confirmation email.
      // To intercept and send via Resend, we can either use custom SMTP settings in Supabase Dashboard,
      // OR we use the admin API to generate a signup link and send it manually.
      // We will do the manual approach via a new API endpoint.
      const signupRes = await fetch('/api/auth/signup-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!signupRes.ok) {
        const errorData = await signupRes.json();
        setError(errorData.error || "Failed to register user");
      } else {
        setError("Check your email for the confirmation link!");
      }
    } catch (err) {
      setError("An unexpected error occurred during sign up.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 1. Check if the email is registered
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (!checkRes.ok) {
        setError("Failed to verify email. Please try again.");
        setLoading(false);
        return;
      }
      
      const { exists } = await checkRes.json();
      
      if (!exists) {
        setError("This email address is not registered in our system.");
        setLoading(false);
        return;
      }

      // 2. Proceed with sending reset link via Resend API
      const resetRes = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!resetRes.ok) {
        const resetError = await resetRes.json();
        setError(resetError.error || "Failed to send reset email");
      } else {
        setError("Check your email for the password reset link!");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            {isForgotPassword ? "Reset your password" : "Sign in to PaperPilot"}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isForgotPassword ? "Enter your email and we'll send you a reset link" : "Or create a new account to start enhancing your academic writing"}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={isForgotPassword ? handleResetPassword : handleLogin}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              />
            </div>
            {!isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                />
              </div>
            )}
          </div>

          {!isForgotPassword && (
            <div className="flex items-center justify-end">
              <div className="text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setError(null);
                  }}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Forgot your password?
                </button>
              </div>
            </div>
          )}

          {error && <div className={`${error.includes('Check your email') ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'} p-3 rounded-md text-sm text-center font-medium`}>{error}</div>}

          {isForgotPassword ? (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={handleResetPassword}
                disabled={loading}
                className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setError(null);
                }}
                className="group relative flex w-full justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Back to login
              </button>
            </div>
          ) : (
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleLogin}
                disabled={loading}
                className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Sign In"}
              </button>
              <button
                type="button"
                onClick={handleSignUp}
                disabled={loading}
                className="group relative flex w-full justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Sign Up
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}