"use client"

import { Loader2, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"

type AuthMode = "login" | "register"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register"
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Something went wrong, please try again.")
        return
      }
      router.push("/")
      router.refresh()
    } catch {
      setError("Network error, please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="relative w-full max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="glass-card rounded-2xl p-8">
          <header className="mb-6 space-y-2 text-center">
            <div className="inline-flex items-center justify-center p-2 rounded-2xl bg-white/5 mb-4 border border-white/5 ring-1 ring-white/10 shadow-lg">
              <Sparkles className="w-6 h-6 text-violet-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              <span className="bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-white/60">
                TaskMaster
              </span>
            </h1>
            <p className="text-sm text-muted-foreground font-medium">
              {mode === "login" ? "Welcome back." : "Create your account."}
            </p>
          </header>

          <div className="grid grid-cols-2 gap-1 p-1 mb-6 bg-white/5 rounded-xl border border-white/10">
            {(["login", "register"] as const).map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => {
                  setMode(candidate)
                  setError(null)
                }}
                className={cn(
                  "py-2 rounded-lg text-sm font-medium transition-all",
                  mode === candidate
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-500/20"
                    : "text-muted-foreground hover:text-white"
                )}
              >
                {candidate === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
              required
              autoComplete="email"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password (min. 8 characters)"
              required
              minLength={8}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
            />

            {error && (
              <p className="text-sm text-red-400 px-1" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-violet-500 disabled:opacity-50 transition-all shadow-lg shadow-violet-500/20"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
