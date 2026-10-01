import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import { passwordOk } from "../validation";
import AuthLayout from "./AuthLayout";
import PasswordChecklist from "./PasswordChecklist";

const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 " +
    "placeholder-slate-400 outline-none transition " +
    "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 " +
    "disabled:bg-slate-50 disabled:text-slate-400"

function ResetPassword() {
    const { token } = useParams()
    const { refreshUser } = useAuth()
    const { t, errorText } = useLanguage()

    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [error, setError] = useState(null)
    const [done, setDone] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()

        if (!passwordOk(password)) {
            setError({ key: "validation.weakPassword" })
            return
        }
        if (password !== confirm) {
            setError({ key: "reset.mismatch" })
            return
        }

        try {
            setError(null)
            setSubmitting(true)

            await apiPost("/reset-password", { token: token, new_password: password })

            await refreshUser()
            setDone(true)
        } catch (e) {
            setError(e)
        } finally {
            setSubmitting(false)
        }
    }

    if (done) {
        return (
            <AuthLayout title={t("reset.doneTitle")} subtitle={t("reset.doneSubtitle")}>
                <Link
                    to="/login"
                    className="block w-full rounded-lg bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
                >
                    {t("reset.signInNew")}
                </Link>
            </AuthLayout>
        )
    }

    return (
        <AuthLayout
            title={t("reset.title")}
            subtitle={t("reset.subtitle")}
            footer={
                <>
                    {t("reset.notWorking")}{" "}
                    <Link to="/forgot-password" className="font-medium text-brand-700 hover:text-brand-800 underline underline-offset-2">
                        {t("reset.requestNew")}
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                        {t("reset.newPassword")}
                    </label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder={t("auth.newPasswordPlaceholder")}
                        className={inputClass}
                        disabled={submitting}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <PasswordChecklist password={password} />
                </div>

                <div>
                    <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-1">
                        {t("reset.confirm")}
                    </label>
                    <input
                        id="confirm"
                        type="password"
                        autoComplete="new-password"
                        placeholder={t("reset.confirmPlaceholder")}
                        className={inputClass}
                        disabled={submitting}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                    />
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                        {errorText(error)}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition
                               hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40
                               disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                    {submitting ? t("reset.saving") : t("reset.submit")}
                </button>
            </form>
        </AuthLayout>
    )
}

export default ResetPassword
