import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPatch, apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import { inputClass } from "../form";
import { useConfirm } from "../confirm-context";
import { Trash2, UserX } from "lucide-react";
import { alertError, btnDanger, btnPrimary, pageSub, pageTitle, panel, panelTitle } from "../ui";
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
    const confirm = useConfirm()
    const [password, setPassword] = useState("")
    const [error, setError] = useState(null)
    const [busy, setBusy] = useState(false)

    async function deactivate(e) {
        e.preventDefault()
        if (!password) {
            setError({ key: "validation.required" })
            return
        }
        const ok = await confirm({
            title: t("confirm.deactivate.title"),
            body: t("confirm.deactivate.body"),
            confirmLabel: t("confirm.deactivate.button"),
            Icon: UserX,
        })
        if (!ok) return
        try {
            setError(null)
            setBusy(true)
            await apiPost("/users/me/deactivate", { password })
            // Leave this signed-in-only page first; clearing the user while still here would make
            // RequireAuth send them to the login page instead of home.
            navigate("/", { replace: true })
            await refreshUser()
        } catch (e) {
            setError(e)
            setBusy(false)
        }
    }

    return (
        <section className={`${panel} mt-6`}>
            <h2 className="text-base font-semibold text-error">{t("deactivate.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("deactivate.body")}</p>
            <form onSubmit={deactivate} noValidate className="mt-4 space-y-3">
                <label htmlFor="deactivate-password" className="block text-sm font-medium text-ink">
                    {t("deactivate.password")}
                </label>
                <input id="deactivate-password" type="password" autoComplete="current-password" maxLength={128}
                       className={inputClass(Boolean(error))} disabled={busy}
                       value={password} onChange={(e) => setPassword(e.target.value)} />
                {error && <p role="alert" className="text-sm text-error">{errorText(error)}</p>}
                <button
                    type="submit"
                    disabled={busy}
                    className={btnDanger}
                >
                    {busy ? t("common.sending") : t("deactivate.button")}
                </button>
            </form>
        </section>
    )
}

// Permanent delete. Two deliberate steps (tick the box + password), then a last browser confirm.
function DeleteSection() {
    const { refreshUser } = useAuth()
    const { t, errorText } = useLanguage()
    const navigate = useNavigate()
    const confirm = useConfirm()
    const [password, setPassword] = useState("")
    const [understood, setUnderstood] = useState(false)
    const [error, setError] = useState(null)
    const [busy, setBusy] = useState(false)

    async function remove(e) {
        e.preventDefault()
        if (!understood) {
            setError({ key: "delete.mustConfirm" })
            return
        }
        if (!password) {
            setError({ key: "validation.required" })
            return
        }
        const ok = await confirm({
            title: t("confirm.deleteAccount.title"),
            body: t("confirm.deleteAccount.body"),
            confirmLabel: t("confirm.deleteAccount.button"),
            Icon: Trash2,
        })
        if (!ok) return
        try {
            setError(null)
            setBusy(true)
            await apiPost("/users/me/delete", { password })
            navigate("/", { replace: true }) // leave first, same reason as in DeactivateSection
            await refreshUser()
        } catch (e) {
            setError(e)
            setBusy(false)
        }
    }

    return (
        <section className={`${panel} mt-4`}>
            <h2 className="text-base font-semibold text-error">{t("delete.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("delete.body")}</p>
            <form onSubmit={remove} noValidate className="mt-4 space-y-3">
                <label className="flex items-start gap-2 text-sm text-ink">
                    <input type="checkbox" checked={understood} disabled={busy}
                           onChange={(e) => setUnderstood(e.target.checked)} className="mt-0.5 accent-link" />
                    {t("delete.understand")}
                </label>
                <label htmlFor="delete-password" className="block text-sm font-medium text-ink">
                    {t("deactivate.password")}
                </label>
                <input id="delete-password" type="password" autoComplete="current-password" maxLength={128}
                       className={inputClass(Boolean(error))} disabled={busy}
                       value={password} onChange={(e) => setPassword(e.target.value)} />
                {error && <p role="alert" className="text-sm text-error">{errorText(error)}</p>}
                <button
                    type="submit"
                    disabled={busy}
                    className={btnDanger}
                >
                    {busy ? t("common.sending") : t("delete.button")}
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
            <div>
                <BackLink />
                <h1 className={`${pageTitle} mt-2`}>{t("edit.title")}</h1>
                <p className={pageSub}>{t("edit.emailNote", { email: user.email })}</p>

                <form onSubmit={save} noValidate className={`${panel} mt-4 space-y-6`}>
                    <section className="space-y-4">
                        <h2 className={panelTitle}>{t("section.personal")}</h2>
                        <PersonalFields person={person} setPerson={setPerson} errors={fieldErrors} disabled={saving} />
                    </section>
                    <section className="space-y-4 border-t border-border pt-6">
                        <h2 className={panelTitle}>{t("section.address")}</h2>
                        <AddressFields address={address} setAddress={setAddress} errors={fieldErrors} disabled={saving} />
                    </section>

                    {showError && (
                        <p role="alert" className={alertError}>{errorText(error)}</p>
                    )}

                    {/* Save at the bottom right (DESIGN.md), the one primary button on this page. */}
                    <div className="flex justify-end border-t border-border pt-4">
                        <button type="submit" disabled={saving} className={btnPrimary}>
                            {saving ? t("reset.saving") : t("common.saveChanges")}
                        </button>
                    </div>
                </form>

                {/* Admins can neither deactivate nor delete here, so the site always keeps an admin. */}
                {user.role !== "admin" && (
                    <>
                        <DeactivateSection />
                        <DeleteSection />
                    </>
                )}
            </div>
        </Layout>
    )
}

export default EditProfile
