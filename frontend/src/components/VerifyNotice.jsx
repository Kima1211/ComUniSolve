import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import LanguageSwitcher from "./LanguageSwitcher";

const RESEND_SECONDS = 60

// Email OTP: the user types the 6-digit code from the email (5 tries per code, 10 minutes).
function VerifyNotice() {
    const { user, loading, refreshUser, logout } = useAuth()
    const { t, errorText } = useLanguage()
    const navigate = useNavigate()
    const location = useLocation()

    const [code, setCode] = useState("")
    const [verifying, setVerifying] = useState(false)
    const [sent, setSent] = useState(false)
    const [error, setError] = useState(location.state?.emailFailed ? { key: "notice.emailFailed" } : null)
    const [sending, setSending] = useState(false)
    const [cooldown, setCooldown] = useState(0)

    const sentAt = user?.verification_sent_at
    useEffect(() => {
        if (!sentAt) return
        const tick = () => {
            const left = Math.ceil((new Date(sentAt).getTime() + RESEND_SECONDS * 1000 - Date.now()) / 1000)
            setCooldown(left > 0 ? left : 0)
        }
        tick()
        const timer = setInterval(tick, 1000)
        return () => clearInterval(timer)
    }, [sentAt])

    if (loading) return null
    if (!user) return <Navigate to="/login" replace />
    if (user.is_verified) return <Navigate to="/" replace />

    async function handleVerify(e) {
        e.preventDefault()
        if (code.length !== 6) {
            setError({ key: "validation.code" })
            return
        }
        try {
            setError(null); setSent(false); setVerifying(true)
            await apiPost("/verify-code", { code })
            await refreshUser()
        } catch (e) {
            setError(e)
            setCode("")
        } finally {
            setVerifying(false)
        }
    }

    async function handleResend() {
        try {
            setError(null); setSent(false); setSending(true)
            await apiPost("/resend-verification")
            setSent(true)
            setCode("")
            await refreshUser()
        } catch (e) {
            setError(e)
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
                <div className="flex justify-end">
                    <LanguageSwitcher />
                </div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-xl text-brand-700">
                    ✉
                </div>

                <h1 className="mt-5 text-xl font-bold text-slate-900">{t("notice.title")}</h1>
                <p className="mt-2 text-sm text-slate-600">
                    {t("notice.sentTo")}<br />
                    <span className="font-medium text-slate-900">{user.email}</span>
                </p>
                <p className="mt-3 text-sm text-slate-500">{t("notice.enterCode")}</p>

                <form onSubmit={handleVerify} noValidate className="mt-5">
                    <label htmlFor="code" className="sr-only">{t("notice.codeLabel")}</label>
                    <input
                        id="code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="••••••"
                        value={code}
                        disabled={verifying}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center font-mono text-2xl tracking-[0.5em]
                                   outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                    />
                    <button
                        type="submit"
                        disabled={verifying || code.length !== 6}
                        className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white
                                   hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        {verifying ? t("notice.verifying") : t("notice.verify")}
                    </button>
                </form>

                {sent && (
                    <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {t("notice.newCode")}
                    </p>
                )}
                {error && (
                    <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {errorText(error)}
                    </p>
                )}

                <button
                    type="button"
                    onClick={handleResend}
                    disabled={sending || cooldown > 0}
                    className="mt-4 text-sm font-medium text-brand-700 hover:text-brand-800 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                    {sending
                        ? t("common.sending")
                        : cooldown > 0
                            ? t("notice.resendIn", { seconds: cooldown })
                            : t("notice.resend")}
                </button>

                <p className="mt-3 text-xs text-slate-500">{t("notice.spam")}</p>

                <button
                    type="button"
                    onClick={handleLogout}
                    className="mt-6 text-sm font-medium text-slate-500 hover:text-slate-900"
                >
                    {t("nav.logout")}
                </button>
            </div>
        </div>
    )
}

export default VerifyNotice
