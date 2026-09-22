"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"working" | "error">("working");
  const [message, setMessage] = useState("Completing your sign-in…");

  useEffect(() => {
    let active = true;

    async function completeSignIn() {
      const params = new URLSearchParams(window.location.search);
      const providerError = params.get("error_description") || params.get("error");
      if (providerError) {
        if (!active) return;
        setStatus("error");
        setMessage(providerError);
        return;
      }

      const code = params.get("code");
      if (!code) {
        router.replace("/");
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!active) return;
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      router.replace("/");
    }

    completeSignIn();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05070d] px-4 text-white">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur">
        {status === "working" ? (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-rose-300" />
            <h1 className="mt-4 text-lg font-semibold">{message}</h1>
            <p className="mt-2 text-sm text-slate-300">
              Hang tight while we finish connecting your Google account.
            </p>
          </>
        ) : (
          <>
            <ShieldAlert className="mx-auto h-8 w-8 text-rose-400" />
            <h1 className="mt-4 text-lg font-semibold">Sign-in couldn’t be completed</h1>
            <p className="mt-2 break-words text-sm text-slate-300">{message}</p>
            <button
              type="button"
              onClick={() => router.replace("/")}
              className="mt-5 w-full rounded-lg bg-[#c41e3a] py-2.5 text-sm font-medium text-white hover:bg-[#a81830]"
            >
              Back to SurgeJob
            </button>
          </>
        )}
      </div>
    </div>
  );
}
