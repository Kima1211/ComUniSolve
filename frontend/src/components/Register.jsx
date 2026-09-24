import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { useAuth } from "../auth-context";
import AuthLayout from "./AuthLayout";

const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 " +
    "placeholder-slate-400 outline-none transition " +
    "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 " +
    "disabled:bg-slate-50 disabled:text-slate-400"

function Register() {
    const navigate = useNavigate()
    const { refreshUser } = useAuth()

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()

        try {
            setError("")
            setSubmitting(true)

            const data = await apiPost("/register", { name: name, email: email, password: password })
            await refreshUser()
            navigate("/verify-email", { replace: true, state: { emailFailed: data.email_sent === false } })
        } catch (e) {
            setError(e.message || "Something went wrong! Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <AuthLayout
            title="Create your account"
            subtitle="Join your community and start solving problems together."
            footer={
                <>
                    Already have an account?{" "}
                    <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800 underline underline-offset-2">
                        Sign in
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                        Name
                    </label>
                    <input
                        id="name"
                        type="text"
                        autoComplete="name"
                        placeholder="Juan dela Cruz"
                        className={inputClass}
                        disabled={submitting}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>

                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        className={inputClass}
                        disabled={submitting}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="At least 8 characters"
                        className={inputClass}
                        disabled={submitting}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-slate-500">Must be at least 8 characters.</p>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition
                               hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40
                               disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                    {submitting ? "Creating account..." : "Create account"}
                </button>
            </form>
        </AuthLayout>
    )
}

export default Register
