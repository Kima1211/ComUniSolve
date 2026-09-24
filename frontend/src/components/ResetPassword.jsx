import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiPost } from "../api";
import { useAuth } from "../auth-context";
import AuthLayout from "./AuthLayout";

const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 " +
    "placeholder-slate-400 outline-none transition " +
    "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 " +
    "disabled:bg-slate-50 disabled:text-slate-400"

function ResetPassword() {
    const { token } = useParams()
    const { refreshUser } = useAuth()

    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [error, setError] = useState("")
    const [done, setDone] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()

        if (password !== confirm) {
            setError("The two passwords don't match.")
            return
        }

        try {
            setError("")
            setSubmitting(true)

            await apiPost("/reset-password", { token: token, new_password: password })

            await refreshUser()
            setDone(true)
        } catch (e) {
            setError(e.message || "Something went wrong! Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    if (done) {
        return (
            <AuthLayout title="Password updated" subtitle="Your password has been reset. You've been signed out of every device.">
                <Link
                    to="/login"
                    className="block w-full rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
                >
                    Sign in with your new password
                </Link>
            </AuthLayout>
        )
    }

    return (
        <AuthLayout
            title="Choose a new password"
            subtitle="This link works once and expires 30 minutes after it was sent."
            footer={
                <>
                    Link not working?{" "}
                    <Link to="/forgot-password" className="font-medium text-brand-700 hover:text-brand-800 underline underline-offset-2">
                        Request a new one
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                        New password
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

                <div>
                    <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-1">
                        Confirm new password
                    </label>
                    <input
                        id="confirm"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Type it again"
                        className={inputClass}
                        disabled={submitting}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                    />
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
                    {submitting ? "Saving..." : "Reset password"}
                </button>
            </form>
        </AuthLayout>
    )
}

export default ResetPassword
