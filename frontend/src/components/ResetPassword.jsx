import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import { passwordOk } from "../validation";
import { inputClass } from "../form";
import { alertError, btnPrimary, link } from "../ui";
import AuthLayout from "./AuthLayout";
import PasswordInput from "./PasswordInput";
import PasswordChecklist from "./PasswordChecklist";

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
                    className={`${btnPrimary} w-full`}
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
                    <Link to="/forgot-password" className={link}>
                        {t("reset.requestNew")}
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div>
                    <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
                        {t("reset.newPassword")}
                    </label>
                    <PasswordInput
                        id="password"
                        autoComplete="new-password"
                        placeholder={t("auth.newPasswordPlaceholder")}
                        className={inputClass()}
                        disabled={submitting}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>

                <div>
                    <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-ink">
                        {t("reset.confirm")}
                    </label>
                    <PasswordInput
                        id="confirm"
                        autoComplete="new-password"
                        placeholder={t("reset.confirmPlaceholder")}
                        className={inputClass()}
                        disabled={submitting}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                    />
                    <PasswordChecklist password={password} />
                </div>

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
                    {submitting ? t("reset.saving") : t("reset.submit")}
                </button>
            </form>
        </AuthLayout>
    )
}

export default ResetPassword
