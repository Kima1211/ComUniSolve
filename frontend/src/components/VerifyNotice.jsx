import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import LanguageSwitcher from "./LanguageSwitcher";

function VerifyNotice() {
    const { user, loading, refreshUser, logout } = useAuth()
    const { t, errorText } = useLanguage()
    const navigate = useNavigate()
    const location = useLocation()

    const [sent, setSent] = useState(false)
    const [error, setError] = useState(location.state?.emailFailed ? { key: "notice.emailFailed" } : null)
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
            setError(null); setSent(false); setSending(true)
            await apiPost("/resend-verification")
            setSent(true)
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
                <p className="mt-3 text-sm text-slate-500">{t("notice.clickLink")}</p>

                {sent && (
                    <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {t("notice.sent")}
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
                    className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white
                               hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                    {sending
                        ? t("common.sending")
                        : cooldown > 0
                            ? t("notice.resendIn", { seconds: cooldown })
                            : t("notice.resend")}
                </button>

                <p className="mt-4 text-xs text-slate-500">{t("notice.spam")}</p>

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
