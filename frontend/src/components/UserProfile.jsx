import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import Layout, { TierBadge } from "./Layout";
import { InstallSection } from "./InstallButton";
import BackLink from "./BackLink";

function fullName(u) {
    return [u.first_name, u.middle_name, u.last_name, u.suffix].filter(Boolean).join(" ")
}

function addressText(u) {
    const a = u.address || {}
    return [u.street, a.barangay, a.city, a.province, a.region].filter(Boolean).join(", ")
}

function Stat({ label, value }) {
    return (
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-center">
            <p className="text-xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500">{label}</p>
        </div>
    )
}

// Used for both /users/:id (public) and /profile (own, shows email + change password).
function UserProfile({ own = false }) {
    const params = useParams()
    const { user } = useAuth()
    const { t, label, formatDate, errorText } = useLanguage()
    const userId = own ? user?.id : params.id

    // Remembers which id the result is for, so switching profiles shows loading instead of the old one.
    const [result, setResult] = useState({ id: null, profile: null, error: null })
    const loading = String(result.id) !== String(userId)
    const { profile, error } = result

    const [resetSent, setResetSent] = useState(false)
    const [resetError, setResetError] = useState(null)
    const [sendingReset, setSendingReset] = useState(false)

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

    if (loading) {
        return (
            <Layout>
                <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />
            </Layout>
        )
    }

    if (error || !profile) {
        return (
            <Layout>
                <BackLink />
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error ? errorText(error, "profile.notFound") : t("profile.notFound")}
                </div>
            </Layout>
        )
    }

    return (
        <Layout>
            <BackLink />
            <section className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900">{profile.name}</h1>
                    <TierBadge tier={profile.tier} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                    {t("profile.pointsJoined", { points: profile.points, date: formatDate(profile.created_at) })}
                </p>

                {own && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                        <p className="text-sm text-slate-600">
                            {t("profile.email")} <span className="font-medium text-slate-900">{user.email}</span>
                        </p>
                        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                            <dt className="text-slate-500">{t("profile.fullName")}</dt>
                            <dd className="text-slate-900">{fullName(user) || t("profile.notSet")}</dd>
                            <dt className="text-slate-500">{t("personal.birthDate")}</dt>
                            <dd className="text-slate-900">{user.birth_date ? formatDate(user.birth_date) : t("profile.notSet")}</dd>
                            <dt className="text-slate-500">{t("personal.sex")}</dt>
                            <dd className="text-slate-900">
                                {user.sex === "male" ? t("personal.sexMale") : user.sex === "female" ? t("personal.sexFemale") : t("personal.sexUnspecified")}
                            </dd>
                            <dt className="text-slate-500">{t("section.address")}</dt>
                            <dd className="text-slate-900">{addressText(user) || t("profile.notSet")}</dd>
                        </dl>
                        {(!user.birth_date || !user.barangay_code) && (
                            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                {t("profile.completeHint")}
                            </p>
                        )}
                        <Link
                            to="/profile/edit"
                            className="mr-2 mt-3 inline-block rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                        >
                            {t("profile.edit")}
                        </Link>
                        <button
                            type="button"
                            onClick={handleChangePassword}
                            disabled={sendingReset}
                            className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700
                                       hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                            {sendingReset ? t("common.sending") : t("profile.changePassword")}
                        </button>
                        {resetSent && (
                            <p className="mt-2 text-sm text-emerald-700">
                                {t("forgot.sent")} {t("common.checkSpam")}
                            </p>
                        )}
                        {resetError && <p className="mt-2 text-sm text-red-700">{errorText(resetError)}</p>}
                    </div>
                )}

                {own && <InstallSection />}

                <div className="mt-5 grid grid-cols-3 gap-3">
                    <Stat label={t("profile.statProblems")} value={profile.problem_count} />
                    <Stat label={t("profile.statSolutions")} value={profile.solution_count} />
                    <Stat label={t("profile.statAccepted")} value={profile.accepted_count} />
                </div>
            </section>

            <section className="mt-6">
                <h2 className="font-semibold text-slate-900">{t("profile.problems")}</h2>
                {profile.problems.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">{t("profile.noProblems")}</p>
                ) : (
                    <div className="mt-2 space-y-2">
                        {profile.problems.map((p) => (
                            <Link
                                key={p.id}
                                to={`/problems/${p.id}`}
                                className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-brand-300"
                            >
                                <p className="font-medium text-slate-900">{p.title}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {label("category", p.category)} · {p.status === "resolved" ? t("common.resolved") : t("common.open")} · {formatDate(p.created_at)}
                                </p>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            <section className="mt-6">
                <h2 className="font-semibold text-slate-900">{t("profile.solutions")}</h2>
                {profile.solutions.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">{t("profile.noSolutions")}</p>
                ) : (
                    <div className="mt-2 space-y-2">
                        {profile.solutions.map((s) => (
                            <Link
                                key={s.id}
                                to={`/problems/${s.problem_id}`}
                                className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-brand-300"
                            >
                                <p className="text-xs text-slate-500">
                                    {t("profile.on")} <span className="font-medium text-slate-700">{s.problem_title}</span>
                                    {s.status === "accepted" && (
                                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                                            {t("profile.accepted")}
                                        </span>
                                    )}
                                </p>
                                <p className="mt-1 text-sm text-slate-700 line-clamp-2">{s.solution_text}</p>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </Layout>
    )
}

export default UserProfile
