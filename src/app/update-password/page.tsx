"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updatePasswordAction } from "@/app/actions/auth";

export default function UpdatePasswordPage() {
  const [state, formAction, isPending] = useActionState(updatePasswordAction, { error: null, success: null });
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.success, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow-sm border border-gray-200">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Set new password
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please enter your new password below
          </p>
        </div>
        <form className="mt-8 space-y-6" action={formAction}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                name="password"
                type="password"
                required
                defaultValue=""
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                name="confirmPassword"
                type="password"
                required
                defaultValue=""
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              />
            </div>
          </div>

          {state?.error && <div className="text-red-500 bg-red-50 p-3 rounded-md text-sm text-center font-medium">{state.error}</div>}
          {state?.success && <div className="text-green-600 bg-green-50 p-3 rounded-md text-sm text-center font-medium">{state.success}</div>}

          <button
            type="submit"
            disabled={isPending || !!state?.success}
            className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {isPending ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
