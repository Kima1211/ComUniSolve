import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import { alertError, alertNote, btnPrimary, btnSecondary, chip, pageTitle, panel, panelTitle } from "../ui";
import Layout, { TierBadge } from "./Layout";
import Avatar from "./Avatar";
import { StatusChip } from "./ProblemFeed";
import { InstallSection } from "./InstallButton";
import BackLink from "./BackLink";

function fullName(u) {
    return [u.first_name, u.middle_name, u.last_name, u.suffix].filter(Boolean).join(" ")
}

function addressText(u) {
    const a = u.address || {}
    return [u.street, a.barangay, a.city, a.province, a.region].filter(Boolean).join(", ")
}

function UserProfile({ own = false }) {
    const params = useParams()
    const navigate = useNavigate()
    const { user, logout } = useAuth()
    const { t, label, formatDate, errorText } = useLanguage()
    const userId = own ? user?.id : params.id

    const [result, setResult] = useState({ id: null, profile: null, error: null })
    const loading = String(result.id) !== String(userId)
    const { profile, error } = result

    const [resetSent, setResetSent] = useState(false)
    const [resetError, setResetError] = useState(null)
    const [sendingReset, setSendingReset] = useState(false)
    const [activeTab, setActiveTab] = useState("problems")

    useEffect(() => {
        if (!userId) return
        let cancelled = false
        apiGet(`/users/${userId}/profile`)
            .then((data) => { if (!cancelled) setResult({ id: userId, profile: data, error: null }) })
            .catch((e) => {
                if (!cancelled) setResult({ id: userId, profile: null, error: e })
            })
        return () => { cancelled = true }
    }, [userId])

    // Reuses the forgot-password flow, so changing a password also ends every other session.
    async function handleChangePassword() {
        try {
            setResetError(null)
            setResetSent(false)
            setSendingReset(true)
            await apiPost("/forgot-password", { email: user.email })
            setResetSent(true)
        } catch (e) {
            setResetError(e)
        } finally {
            setSendingReset(false)
        }
    }

    // Navigate first: /profile needs a signed-in user, so logging out here would bounce to /login.
    async function handleLogout() {
        navigate("/", { replace: true })
        await logout()
    }

    if (loading) {
        return (
            <Layout>
                <div className="h-40 animate-pulse rounded-lg border border-border bg-surface" />
            </Layout>
        )
    }

    if (error || !profile) {
        return (
            <Layout>
                <BackLink />
                <p role="alert" className={`${alertError} mt-3`}>
                    {error ? errorText(error, "profile.notFound") : t("profile.notFound")}
                </p>
            </Layout>
        )
    }

    const tabs = [
        { key: "problems", label: t("profile.problems"), count: profile.problem_count },
        { key: "solutions", label: t("profile.solutions"), count: profile.solution_count },
    ]

    return (
        <Layout>
            <BackLink />

            <section className={`${panel} mt-3`}>
                <div className="flex items-center gap-4">
                    <Avatar name={profile.name} size="lg" />
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className={pageTitle}>{profile.name}</h1>
                            <TierBadge tier={profile.tier} />
                        </div>
                        <p className="mt-0.5 text-sm text-muted">
                            {t("profile.pointsJoined", { points: profile.points, date: formatDate(profile.created_at) })}
                        </p>
                    </div>
                </div>

                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-border pt-4">
                    {[
                        [t("profile.statProblems"), profile.problem_count],
                        [t("profile.statSolutions"), profile.solution_count],
                        [t("profile.statAccepted"), profile.accepted_count],
                    ].map(([name, value]) => (
                        <div key={name}>
                            <dt className="text-xs text-muted">{name}</dt>
                            <dd className="text-[17px] font-semibold tabular-nums text-ink">{value}</dd>
                        </div>
                    ))}
                </dl>
            </section>

            {own && (
                <section className={`${panel} mt-4`}>
                    <h2 className={panelTitle}>{t("profile.details")}</h2>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                        <dt className="text-muted">{t("auth.email")}</dt>
                        <dd className="break-all text-ink">{user.email}</dd>
                        <dt className="text-muted">{t("profile.fullName")}</dt>
                        <dd className="text-ink">{fullName(user) || t("profile.notSet")}</dd>
                        <dt className="text-muted">{t("personal.birthDate")}</dt>
                        <dd className="text-ink">{user.birth_date ? formatDate(user.birth_date) : t("profile.notSet")}</dd>
                        <dt className="text-muted">{t("personal.sex")}</dt>
                        <dd className="text-ink">
                            {user.sex === "male" ? t("personal.sexMale") : user.sex === "female" ? t("personal.sexFemale") : t("personal.sexUnspecified")}
                        </dd>
                        <dt className="text-muted">{t("section.address")}</dt>
                        <dd className="text-ink">{addressText(user) || t("profile.notSet")}</dd>
                    </dl>

                    {(!user.birth_date || !user.barangay_code) && (
                        <p className={`${alertNote} mt-3`}>{t("profile.completeHint")}</p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link to="/profile/edit" className={btnPrimary}>{t("profile.edit")}</Link>
                        <button type="button" onClick={handleChangePassword} disabled={sendingReset} className={btnSecondary}>
                            {sendingReset ? t("common.sending") : t("profile.changePassword")}
                        </button>
                        <button type="button" onClick={handleLogout} className={btnSecondary}>
                            {t("nav.logout")}
                        </button>
                    </div>
                    {resetSent && (
                        <p role="status" className={`${alertNote} mt-3`}>{t("forgot.sent")} {t("common.checkSpam")}</p>
                    )}
                    {resetError && <p role="alert" className={`${alertError} mt-3`}>{errorText(resetError)}</p>}

                    <InstallSection />
                </section>
            )}

            <div role="tablist" aria-label={profile.name} className="mt-6 flex gap-6 border-b border-border">
                {tabs.map((tab) => {
                    const active = tab.key === activeTab
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setActiveTab(tab.key)}
                            className={`relative -mb-px h-11 text-sm font-medium ${
                                active ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted hover:text-ink"
                            }`}
                        >
                            {tab.label} <span className="tabular-nums text-muted">{tab.count}</span>
                        </button>
                    )
                })}
            </div>

            {activeTab === "problems" && (
                profile.problems.length === 0 ? (
                    <p className="py-8 text-sm text-muted">{t("profile.noProblems")}</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {profile.problems.map((p) => (
                            <li key={p.id}>
                                <Link to={`/problems/${p.id}`} className="-mx-2 block rounded-md px-2 py-3 hover:bg-surface-2">
                                    <p className="text-[17px] font-semibold leading-snug text-ink">
                                        {p.title}
                                        <span className="ml-2 align-middle"><StatusChip status={p.status} t={t} /></span>
                                    </p>
                                    <p className="mt-1 flex flex-wrap gap-x-2 text-[13px] text-muted">
                                        <span>{label("category", p.category)}</span>
                                        <span>{formatDate(p.created_at)}</span>
                                    </p>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )
            )}

            {activeTab === "solutions" && (
                profile.solutions.length === 0 ? (
                    <p className="py-8 text-sm text-muted">{t("profile.noSolutions")}</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {profile.solutions.map((s) => (
                            <li key={s.id}>
                                <Link to={`/problems/${s.problem_id}`} className="-mx-2 block rounded-md px-2 py-3 hover:bg-surface-2">
                                    <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
                                        <span>{t("profile.on")} <span className="font-medium text-ink">{s.problem_title}</span></span>
                                        {s.status === "accepted" && (
                                            <span className={`${chip} bg-gold text-on-gold shine`}>{t("profile.accepted")}</span>
                                        )}
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-sm text-ink">{s.solution_text}</p>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )
            )}
        </Layout>
    )
}

export default UserProfile
