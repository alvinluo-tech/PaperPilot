"use client";

import { useState, useActionState, useTransition } from "react";
import { loginAction, signUpAction, resetPasswordAction } from "@/app/actions/auth";

export function LoginForm() {
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  const [loginState, loginFormAction, isLoginPending] = useActionState(loginAction, { error: null });
  const [signUpState, signUpFormAction, isSignUpPending] = useActionState(signUpAction, { error: null, success: null });
  const [resetState, resetFormAction, isResetPending] = useActionState(resetPasswordAction, { error: null, success: null });

  const isPending = isLoginPending || isSignUpPending || isResetPending;
  
  // Combine errors/successes based on mode
  let currentError = null;
  let currentSuccess = null;
  
  if (isForgotPassword) {
    currentError = resetState?.error;
    currentSuccess = resetState?.success;
  } else {
    currentError = loginState?.error || signUpState?.error;
    currentSuccess = signUpState?.success;
  }

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
        <form className="mt-8 space-y-6">
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <input
                name="email"
                type="email"
                required
                defaultValue=""
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              />
            </div>
            {!isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  name="password"
                  type="password"
                  required={!isForgotPassword}
                  defaultValue=""
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
                  onClick={() => setIsForgotPassword(true)}
                  className="font-medium text-blue-600 hover:text-blue-500"
                >
                  Forgot your password?
                </button>
              </div>
            </div>
          )}

          {currentError && <div className="text-red-500 bg-red-50 p-3 rounded-md text-sm text-center font-medium">{currentError}</div>}
          {currentSuccess && <div className="text-green-600 bg-green-50 p-3 rounded-md text-sm text-center font-medium">{currentSuccess}</div>}

          {isForgotPassword ? (
            <div className="flex flex-col gap-4">
              <button
                formAction={resetFormAction}
                disabled={isPending}
                className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isResetPending ? "Sending..." : "Send Reset Link"}
              </button>
              <button
                type="button"
                onClick={() => setIsForgotPassword(false)}
                className="group relative flex w-full justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Back to login
              </button>
            </div>
          ) : (
            <div className="flex gap-4">
              <button
                formAction={loginFormAction}
                disabled={isPending}
                className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isLoginPending ? "Loading..." : "Sign In"}
              </button>
              <button
                formAction={signUpFormAction}
                disabled={isPending}
                className="group relative flex w-full justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isSignUpPending ? "Registering..." : "Sign Up"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}