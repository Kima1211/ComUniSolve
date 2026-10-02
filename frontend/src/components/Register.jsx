import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import { inputClass } from "../form";
import {
    EMPTY_ADDRESS, EMPTY_PERSON, addressErrors, addressPayload, emailError, passwordOk, personErrors, personPayload,
} from "../validation";
import { alertError, btnPrimary, link } from "../ui";
import AuthLayout from "./AuthLayout";
import FormField from "./FormField";
import PersonalFields from "./PersonalFields";
import AddressFields from "./AddressFields";
import PasswordChecklist from "./PasswordChecklist";

function SectionTitle({ children }) {
    return <h2 className="border-b border-border pb-1.5 text-sm font-semibold text-ink">{children}</h2>
}

function Register() {
    const navigate = useNavigate()
    const { refreshUser } = useAuth()
    const { t, errorText } = useLanguage()

    const [person, setPerson] = useState(EMPTY_PERSON)
    const [address, setAddress] = useState(EMPTY_ADDRESS)
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [attempted, setAttempted] = useState(false)
    const [error, setError] = useState(null)
    const [submitting, setSubmitting] = useState(false)

    function findProblems() {
        const problems = { ...personErrors(person), ...addressErrors(address) }
        const emailProblem = emailError(email)
        if (emailProblem) problems.email = emailProblem
        if (!passwordOk(password)) problems.password = "validation.weakPassword"
        return problems
    }

    const fieldErrors = attempted ? findProblems() : {}
    const showError = error && !(error.key === "validation.fixErrors" && Object.keys(fieldErrors).length === 0)

    async function handleSubmit(e) {
        e.preventDefault()

        const problems = findProblems()
        setAttempted(true)
        if (Object.keys(problems).length > 0) {
            setError({ key: "validation.fixErrors" })
            return
        }

        try {
            setError(null)
            setSubmitting(true)

            const data = await apiPost("/register", {
                ...personPayload(person), ...addressPayload(address), email: email.trim(), password,
            })
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
                    <Link to="/login" className={link}>
                        {t("register.signIn")}
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} noValidate className="space-y-6">
                <section className="space-y-4">
                    <SectionTitle>{t("section.personal")}</SectionTitle>
                    <PersonalFields person={person} setPerson={setPerson} errors={fieldErrors} disabled={submitting} />
                </section>

                <section className="space-y-4">
                    <SectionTitle>{t("section.address")}</SectionTitle>
                    <AddressFields address={address} setAddress={setAddress} errors={fieldErrors} disabled={submitting} />
                </section>

                <section className="space-y-4">
                    <SectionTitle>{t("section.account")}</SectionTitle>
                    <FormField id="email" label={t("auth.email")} error={fieldErrors.email}>
                        <input id="email" type="email" autoComplete="email" placeholder={t("auth.emailPlaceholder")}
                               className={inputClass(fieldErrors.email)} disabled={submitting} maxLength={255}
                               value={email} onChange={(e) => setEmail(e.target.value)} />
                    </FormField>
                    <FormField id="password" label={t("auth.password")} error={fieldErrors.password}>
                        <input id="password" type="password" autoComplete="new-password" placeholder={t("auth.newPasswordPlaceholder")}
                               className={inputClass(fieldErrors.password)} disabled={submitting} maxLength={128}
                               value={password} onChange={(e) => setPassword(e.target.value)} />
                        <PasswordChecklist password={password} />
                    </FormField>
                </section>

                {showError && (
                    <div role="alert" className={alertError}>
                        {errorText(error)}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className={`${btnPrimary} w-full`}
                >
                    {submitting ? t("register.submitting") : t("register.submit")}
                </button>
            </form>
        </AuthLayout>
    )
}

export default Register
