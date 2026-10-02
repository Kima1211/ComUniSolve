import { useState } from "react";
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import { inputClass } from "../form";
import { alertError, alertNote, btnPrimary, btnSecondary, link } from "../ui";
import AuthLayout from "./AuthLayout";

function Login() {
    const navigate = useNavigate()
    const location = useLocation()
    const { refreshUser } = useAuth()
    const { t, errorText } = useLanguage()

    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const deactivated = error?.code === "account_deactivated"

    async function finishSignIn() {
        await refreshUser()
        const goingTo = location.state?.from || "/"
        navigate(goingTo, { replace: true })
    }

    async function handleReactivate() {
        try {
            setSubmitting(true)
            await apiPost("/reactivate", { email: email, password: password })
            setError(null)
            await finishSignIn()
        } catch (e) {
            setError(e)
        } finally {
            setSubmitting(false)
        }
    }

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
            await finishSignIn()
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
                    <Link to="/register" className={link}>
                        {t("login.createAccount")}
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                    <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
                        {t("auth.email")}
                    </label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder={t("auth.emailPlaceholder")}
                        className={inputClass()}
                        disabled={submitting}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>

                <div>
                    <div className="mb-1 flex items-center justify-between">
                        <label htmlFor="password" className="block text-sm font-medium text-ink">
                            {t("auth.password")}
                        </label>
                        <Link to="/forgot-password" className="text-sm font-medium text-link hover:underline">
                            {t("auth.forgot")}
                        </Link>
                    </div>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder={t("auth.passwordPlaceholder")}
                        className={inputClass()}
                        disabled={submitting}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                {error && !deactivated && (
                    <div role="alert" className={alertError}>
                        {errorText(error)}
                    </div>
                )}
                {deactivated && (
                    <div role="alert" className={`${alertNote} py-3`}>
                        <p>{t("login.deactivatedBody")}</p>
                        <button
                            type="button"
                            onClick={handleReactivate}
                            disabled={submitting}
                            className={`${btnSecondary} mt-2`}
                        >
                            {submitting ? t("login.reactivating") : t("login.reactivate")}
                        </button>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className={`${btnPrimary} w-full`}
                >
                    {submitting ? t("login.submitting") : t("login.submit")}
                </button>
            </form>
        </AuthLayout>
    )
}

export default Login
