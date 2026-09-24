import { useState } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "../api";
import AuthLayout from "./AuthLayout";

const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 " +
    "placeholder-slate-400 outline-none transition " +
    "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 " +
    "disabled:bg-slate-50 disabled:text-slate-400"

function ForgotPassword() {
    const [email, setEmail] = useState("")
    const [message, setMessage] = useState("")
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()

        try {
            setError("")
            setMessage("")
            setSubmitting(true)

            // The backend answers the same way whether or not the email has an
            // account, so this page never learns (or shows) which it was.
            const data = await apiPost("/forgot-password", { email: email })
            setMessage(data.message)
        } catch (e) {
            setError(e.message || "Something went wrong! Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <AuthLayout
            title="Forgot your password?"
            subtitle="Enter your email and we'll send you a link to choose a new one."
            footer={
                <>
                    Remembered it?{" "}
                    <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800 underline underline-offset-2">
                        Back to sign in
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
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

                {message && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {message} Check your spam folder too.
                    </div>
                )}
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
                    {submitting ? "Sending..." : "Send reset link"}
                </button>
            </form>
        </AuthLayout>
    )
}

export default ForgotPassword
