import { useState } from "react";
import { Link } from "react-router-dom";
import { apiPost } from "../api";
import { useLanguage } from "../i18n/language-context";
import { emailError } from "../validation";
import { inputClass } from "../form";
import { alertError, alertNote, btnPrimary, link } from "../ui";
import AuthLayout from "./AuthLayout";

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
                    <Link to="/login" className={link}>
                        {t("forgot.back")}
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

                {sent && (
                    <div role="status" className={alertNote}>
                        {t("forgot.sent")} {t("common.checkSpam")}
                    </div>
                )}
                {error && (
                    <div role="alert" className={alertError}>
                        {errorText(error)}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className={`${btnPrimary} w-full`}
                >
                    {submitting ? t("common.sending") : t("forgot.submit")}
                </button>
            </form>
        </AuthLayout>
    )
}

export default ForgotPassword
