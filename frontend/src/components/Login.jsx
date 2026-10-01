import { useState } from "react";
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import AuthLayout from "./AuthLayout";

const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 " +
    "placeholder-slate-400 outline-none transition " +
    "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 " +
    "disabled:bg-slate-50 disabled:text-slate-400"

function Login() {
    const navigate = useNavigate()
    const location = useLocation()
    const { refreshUser } = useAuth()
    const { t, errorText } = useLanguage()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        if (!email.trim() || !password) {
            setError({ key: "validation.loginRequired" })
            return
        }

        try {
            setError(null)
            setSubmitting(true)

            await apiPost("/login", { email: email, password: password })

            await refreshUser()

            const goingTo = location.state?.from || "/"
            navigate(goingTo, { replace: true })
        } catch (e) {
            setError(e)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <AuthLayout
            title={t("login.title")}
            subtitle={t("login.subtitle")}
            footer={
                <>
                    {t("login.newHere")}{" "}
                    <Link to="/register" className="font-medium text-brand-700 hover:text-brand-800 underline underline-offset-2">
                        {t("login.createAccount")}
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

                <div>
                    <div className="mb-1 flex items-center justify-between">
                        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                            {t("auth.password")}
                        </label>
                        <Link to="/forgot-password" className="text-sm font-medium text-brand-700 hover:text-brand-800">
                            {t("auth.forgot")}
                        </Link>
                    </div>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder={t("auth.passwordPlaceholder")}
                        className={inputClass}
                        disabled={submitting}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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
                    {submitting ? t("login.submitting") : t("login.submit")}
                </button>
            </form>
        </AuthLayout>
    )
}

export default Login
