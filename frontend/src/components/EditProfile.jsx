import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPatch, apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import { inputClass } from "../form";
import {
    addressErrors, addressFromUser, addressPayload, personErrors, personFromUser, personPayload,
} from "../validation";
import Layout from "./Layout";
import BackLink from "./BackLink";
import PersonalFields from "./PersonalFields";
import AddressFields from "./AddressFields";

function DeactivateSection() {
    const { refreshUser } = useAuth()
    const { t, errorText } = useLanguage()
    const navigate = useNavigate()
    const [password, setPassword] = useState("")
    const [error, setError] = useState(null)
    const [busy, setBusy] = useState(false)

    async function deactivate(e) {
        e.preventDefault()
        if (!password) {
            setError({ key: "validation.required" })
            return
        }
        if (!window.confirm(t("deactivate.confirm"))) return
        try {
            setError(null)
            setBusy(true)
            await apiPost("/users/me/deactivate", { password })
            await refreshUser()
            navigate("/", { replace: true })
        } catch (e) {
            setError(e)
            setBusy(false)
        }
    }

    return (
        <section className="mt-8 rounded-xl border border-red-200 bg-white p-6">
            <h2 className="font-semibold text-red-800">{t("deactivate.title")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("deactivate.body")}</p>
            <form onSubmit={deactivate} noValidate className="mt-4 space-y-3">
                <label htmlFor="deactivate-password" className="block text-sm font-medium text-slate-700">
                    {t("deactivate.password")}
                </label>
                <input id="deactivate-password" type="password" autoComplete="current-password" maxLength={128}
                       className={inputClass(Boolean(error))} disabled={busy}
                       value={password} onChange={(e) => setPassword(e.target.value)} />
                {error && <p className="text-sm text-red-700">{errorText(error)}</p>}
                <button
                    type="submit"
                    disabled={busy}
                    className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800
                               hover:bg-red-100 disabled:opacity-50"
                >
                    {busy ? t("common.sending") : t("deactivate.button")}
                </button>
            </form>
        </section>
    )
}

function EditProfile() {
    const { user, refreshUser } = useAuth()
    const { t, errorText } = useLanguage()
    const navigate = useNavigate()

    const [person, setPerson] = useState(() => personFromUser(user))
    const [address, setAddress] = useState(() => addressFromUser(user))
    const [attempted, setAttempted] = useState(false)
    const [error, setError] = useState(null)
    const [saving, setSaving] = useState(false)

    const findProblems = () => ({ ...personErrors(person), ...addressErrors(address) })
    const fieldErrors = attempted ? findProblems() : {}
    const showError = error && !(error.key === "validation.fixErrors" && Object.keys(fieldErrors).length === 0)

    async function save(e) {
        e.preventDefault()
        const problems = findProblems()
        setAttempted(true)
        if (Object.keys(problems).length > 0) {
            setError({ key: "validation.fixErrors" })
            return
        }
        try {
            setError(null)
            setSaving(true)
            await apiPatch("/users/me", { ...personPayload(person), ...addressPayload(address) })
            await refreshUser()
            navigate("/profile")
        } catch (e) {
            setError(e)
        } finally {
            setSaving(false)
        }
    }

    return (
        <Layout>
            <div className="mx-auto max-w-xl">
                <BackLink />
                <h1 className="mt-4 text-xl font-bold text-slate-900">{t("edit.title")}</h1>
                <p className="mt-1 text-sm text-slate-500">{t("edit.emailNote", { email: user.email })}</p>

                <form onSubmit={save} noValidate className="mt-6 space-y-6 rounded-xl border border-slate-200 bg-white p-6">
                    <section className="space-y-4">
                        <h2 className="font-semibold text-slate-900">{t("section.personal")}</h2>
                        <PersonalFields person={person} setPerson={setPerson} errors={fieldErrors} disabled={saving} />
                    </section>
                    <section className="space-y-4">
                        <h2 className="font-semibold text-slate-900">{t("section.address")}</h2>
                        <AddressFields address={address} setAddress={setAddress} errors={fieldErrors} disabled={saving} />
                    </section>

                    {showError && (
                        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorText(error)}</p>
                    )}

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white
                                   hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        {saving ? t("reset.saving") : t("common.saveChanges")}
                    </button>
                </form>

                {user.role !== "admin" && <DeactivateSection />}
            </div>
        </Layout>
    )
}

export default EditProfile
