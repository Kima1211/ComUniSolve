import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { useAuth } from "../auth-context";

function VerifyNotice() {
    const { user, loading, refreshUser, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const [message, setMessage] = useState("")
    const [error, setError] = useState(
        location.state?.emailFailed
            ? "We couldn't send your verification email. Please use the resend button below."
            : ""
    )
    const [sending, setSending] = useState(false)
    const [cooldown, setCooldown] = useState(0)

    const expiresAt = user?.verification_expires_at
    useEffect(() => {
        if (!expiresAt) return
        const issuedAt = new Date(expiresAt).getTime() - 24 * 60 * 60 * 1000
        const tick = () => {
            const left = Math.ceil((issuedAt + 60_000 - Date.now()) / 1000)
            setCooldown(left > 0 ? left : 0)
        }
        tick()
        const timer = setInterval(tick, 1000)
        return () => clearInterval(timer)
    }, [expiresAt])

    useEffect(() => {
        const timer = setInterval(() => { refreshUser() }, 5000)
        return () => clearInterval(timer)
    }, [refreshUser])

    if (loading) return null
    if (!user) return <Navigate to="/login" replace />
    if (user.is_verified) return <Navigate to="/" replace />

    async function handleResend() {
        try {
            setError(""); setMessage(""); setSending(true)
            const data = await apiPost("/resend-verification")
            setMessage(data.message || "Verification email sent.")
        } catch (e) {
            setError(e.message || "Could not send the email. Please try again.")
        } finally {
            setSending(false)
        }
    }

    async function handleLogout() {
        await logout()
        navigate("/login")
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-xl text-brand-700">
                    ✉
                </div>

                <h1 className="mt-5 text-xl font-bold text-slate-900">Verify your email</h1>
                <p className="mt-2 text-sm text-slate-600">
                    We sent a verification link to<br />
                    <span className="font-medium text-slate-900">{user.email}</span>
                </p>
                <p className="mt-3 text-sm text-slate-500">
                    Click the link to activate your account. This page will continue
                    automatically once you do.
                </p>

                {message && (
                    <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {message}
                    </p>
                )}
                {error && (
                    <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {error}
                    </p>
                )}

                <button
                    type="button"
                    onClick={handleResend}
                    disabled={sending || cooldown > 0}
                    className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white
                               hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                    {sending
                        ? "Sending..."
                        : cooldown > 0
                            ? `Resend available in ${cooldown}s`
                            : "Resend the email"}
                </button>

                <p className="mt-4 text-xs text-slate-500">
                    Check your spam folder too — it can take a few minutes to arrive.
                </p>

                <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-6 text-sm font-medium text-slate-500 hover:text-slate-900"
                >
                    Log out
                </button>
            </div>
        </div>
    )
}

export default VerifyNotice
