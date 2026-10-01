import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import AuthLayout from "./AuthLayout";

const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 " +
    "placeholder-slate-400 outline-none transition " +
    "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 " +
    "disabled:bg-slate-50 disabled:text-slate-400"

function Register() {
    const navigate = useNavigate()
    const { refreshUser } = useAuth()
    const { t, errorText } = useLanguage()

    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()

        try {
            setError(null)
            setSubmitting(true)

            const data = await apiPost("/register", { name: name, email: email, password: password })
            await refreshUser()
            navigate("/verify-email", { replace: true, state: { emailFailed: data.email_sent === false } })
        } catch (e) {
            setError(e)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <AuthLayout
            title={t("register.title")}
            subtitle={t("register.subtitle")}
            footer={
                <>
                    {t("register.haveAccount")}{" "}
                    <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800 underline underline-offset-2">
                        {t("register.signIn")}
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                        {t("register.name")}
                    </label>
                    <input
                        id="name"
                        type="text"
                        autoComplete="name"
                        placeholder={t("register.namePlaceholder")}
                        className={inputClass}
                        disabled={submitting}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>

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

                <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                        {t("auth.password")}
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
                    <p className="mt-1 text-xs text-slate-500">{t("auth.passwordHint")}</p>
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
                    {submitting ? t("register.submitting") : t("register.submit")}
                </button>
            </form>
        </AuthLayout>
    )
}

export default Register
