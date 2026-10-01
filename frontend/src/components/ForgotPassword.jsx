import { useState } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "../api";
import { useLanguage } from "../i18n/language-context";
import { emailError } from "../validation";
import AuthLayout from "./AuthLayout";

const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 " +
    "placeholder-slate-400 outline-none transition " +
    "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 " +
    "disabled:bg-slate-50 disabled:text-slate-400"

function ForgotPassword() {
    const { t, errorText } = useLanguage()
    const [email, setEmail] = useState("")
    const [sent, setSent] = useState(false)
    const [error, setError] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        const problem = emailError(email)
        if (problem) {
            setError({ key: problem })
            return
        }

        try {
            setError(null)
            setSent(false)
            setSubmitting(true)

            await apiPost("/forgot-password", { email: email })
            setSent(true)
        } catch (e) {
            setError(e)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <AuthLayout
            title={t("forgot.title")}
            subtitle={t("forgot.subtitle")}
            footer={
                <>
                    {t("forgot.remembered")}{" "}
                    <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800 underline underline-offset-2">
                        {t("forgot.back")}
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                        {t("auth.email")}
                    </label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder={t("auth.emailPlaceholder")}
                        className={inputClass}
                        disabled={submitting}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                {sent && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                        {t("forgot.sent")} {t("common.checkSpam")}
                    </div>
                )}
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
                    {submitting ? t("common.sending") : t("forgot.submit")}
                </button>
            </form>
        </AuthLayout>
    )
}

export default ForgotPassword
