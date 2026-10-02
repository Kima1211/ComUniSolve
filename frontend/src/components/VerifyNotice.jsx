import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import { Mail } from "lucide-react";
import { alertError, alertNote, btnGhost, btnPrimary } from "../ui";
import AuthLayout from "./AuthLayout";

const RESEND_SECONDS = 60

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
        <AuthLayout title={t("notice.title")}>
            <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-link">
                    <Mail size={20} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <p className="text-sm text-muted">
                    {t("notice.sentTo")}<br />
                    <span className="font-medium text-ink break-all">{user.email}</span>
                </p>
            </div>
            <p className="mt-3 text-sm text-muted">{t("notice.enterCode")}</p>

            <form onSubmit={handleVerify} noValidate className="mt-5">
                <label htmlFor="code" className="mb-1 block text-sm font-medium text-ink">{t("notice.codeLabel")}</label>
                <input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="••••••"
                    value={code}
                    disabled={verifying}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-full rounded-md border border-border bg-surface px-3 py-3 text-center font-mono text-2xl
                               tracking-[0.5em] text-ink placeholder:text-muted disabled:opacity-60"
                />
                <button type="submit" disabled={verifying || code.length !== 6} className={`${btnPrimary} mt-3 w-full`}>
                    {verifying ? t("notice.verifying") : t("notice.verify")}
                </button>
            </form>

            {sent && <p role="status" className={`${alertNote} mt-4`}>{t("notice.newCode")}</p>}
            {error && <p role="alert" className={`${alertError} mt-4`}>{errorText(error)}</p>}

            <div className="mt-4 border-t border-border pt-4">
                <button
                    type="button"
                    onClick={handleResend}
                    disabled={sending || cooldown > 0}
                    className="text-sm font-medium text-link hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
                >
                    {sending
                        ? t("common.sending")
                        : cooldown > 0
                            ? t("notice.resendIn", { seconds: cooldown })
                            : t("notice.resend")}
                </button>
                <p className="mt-2 text-xs text-muted">{t("notice.spam")}</p>
            </div>

            <button type="button" onClick={handleLogout} className={`${btnGhost} -ml-3 mt-4`}>
                {t("nav.logout")}
            </button>
        </AuthLayout>
    )
}

export default VerifyNotice
