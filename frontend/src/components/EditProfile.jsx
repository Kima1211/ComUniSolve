import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPatch, apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import { inputClass } from "../form";
import { useConfirm } from "../confirm-context";
import { LogOut, Trash2, UserX } from "lucide-react";
import { alertError, alertNote, btnDanger, btnPrimary, btnSecondary, pageSub, pageTitle, panel, panelTitle } from "../ui";
import {
    addressErrors, addressFromUser, addressPayload, personErrors, personFromUser, personPayload,
} from "../validation";
import Layout from "./Layout";
import BackLink from "./BackLink";
import PersonalFields from "./PersonalFields";
import AddressFields from "./AddressFields";
import PasswordInput from "./PasswordInput";
import AvatarPicker from "./AvatarPicker";

function SecuritySection() {
    const { user, logout } = useAuth()
    const { t, errorText } = useLanguage()
    const navigate = useNavigate()
    const confirm = useConfirm()
    const [linkSent, setLinkSent] = useState(false)
    const [error, setError] = useState(null)
    const [busy, setBusy] = useState(false)

    // Reuses the forgot-password flow, so the new password also ends every other session.
    async function changePassword() {
        try {
            setError(null)
            setLinkSent(false)
            setBusy(true)
            await apiPost("/forgot-password", { email: user.email })
            setLinkSent(true)
        } catch (e) {
            setError(e)
        } finally {
            setBusy(false)
        }
    }

    // The request comes first: if it fails, the user stays here and sees that other devices are still signed in.
    async function logoutAll() {
        const ok = await confirm({
            title: t("confirm.logoutAll.title"),
            body: t("confirm.logoutAll.body"),
            confirmLabel: t("confirm.logoutAll.button"),
            Icon: LogOut,
        })
        if (!ok) return
        try {
            setError(null)
            setBusy(true)
            await apiPost("/logout-all")
        } catch (e) {
            setError(e)
            setBusy(false)
            return
        }
        navigate("/", { replace: true })
        await logout()
    }

    return (
        <section className={`${panel} mt-6`}>
            <h2 className={panelTitle}>{t("security.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("security.body")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={changePassword} disabled={busy} className={btnSecondary}>
                    {t("profile.changePassword")}
                </button>
                <button type="button" onClick={logoutAll} disabled={busy} className={btnSecondary}>
                    {t("profile.logoutAll")}
                </button>
            </div>
            {linkSent && (
                <p role="status" className={`${alertNote} mt-3`}>{t("security.linkSent", { email: user.email })} {t("common.checkSpam")}</p>
            )}
            {error && <p role="alert" className={`${alertError} mt-3`}>{errorText(error)}</p>}
        </section>
    )
}

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
            // Navigate before clearing the user, or RequireAuth would send them to /login.
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
                <PasswordInput id="deactivate-password" autoComplete="current-password" maxLength={128}
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
            navigate("/", { replace: true })
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
                <PasswordInput id="delete-password" autoComplete="current-password" maxLength={128}
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

                <AvatarPicker />

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

                    <div className="flex justify-end border-t border-border pt-4">
                        <button type="submit" disabled={saving} className={btnPrimary}>
                            {saving ? t("reset.saving") : t("common.saveChanges")}
                        </button>
                    </div>
                </form>

                <SecuritySection />

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
