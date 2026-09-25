import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { useAuth } from "../auth-context";
import Layout, { TierBadge } from "./Layout";

function formatDate(value) {
    return value ? new Date(value).toLocaleDateString() : ""
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
    const userId = own ? user?.id : params.id

    // Remembers which id the result is for, so switching profiles shows loading instead of the old one.
    const [result, setResult] = useState({ id: null, profile: null, error: "" })
    const loading = String(result.id) !== String(userId)
    const { profile, error } = result

    const [resetMessage, setResetMessage] = useState("")
    const [resetError, setResetError] = useState("")
    const [sendingReset, setSendingReset] = useState(false)

    useEffect(() => {
        if (!userId) return
        let cancelled = false
        apiGet(`/users/${userId}/profile`)
            .then((data) => { if (!cancelled) setResult({ id: userId, profile: data, error: "" }) })
            .catch((e) => {
                if (!cancelled) setResult({ id: userId, profile: null, error: e.message || "Something went wrong" })
            })
        return () => { cancelled = true }
    }, [userId])

    // Reuses the forgot-password flow, so changing a password also ends every other session.
    async function handleChangePassword() {
        try {
            setResetError("")
            setResetMessage("")
            setSendingReset(true)
            const data = await apiPost("/forgot-password", { email: user.email })
            setResetMessage(data.message)
        } catch (e) {
            setResetError(e.message || "Something went wrong! Please try again.")
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
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error || "User not found"}
                </div>
            </Layout>
        )
    }

    return (
        <Layout>
            <section className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900">{profile.name}</h1>
                    <TierBadge tier={profile.tier} />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                    {profile.points} points · Joined {formatDate(profile.created_at)}
                </p>

                {own && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                        <p className="text-sm text-slate-600">
                            Email: <span className="font-medium text-slate-900">{user.email}</span>
                        </p>
                        <button
                            type="button"
                            onClick={handleChangePassword}
                            disabled={sendingReset}
                            className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700
                                       hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                            {sendingReset ? "Sending..." : "Change password"}
                        </button>
                        {resetMessage && (
                            <p className="mt-2 text-sm text-emerald-700">
                                {resetMessage} Check your spam folder too.
                            </p>
                        )}
                        {resetError && <p className="mt-2 text-sm text-red-700">{resetError}</p>}
                    </div>
                )}

                <div className="mt-5 grid grid-cols-3 gap-3">
                    <Stat label="Problems" value={profile.problem_count} />
                    <Stat label="Solutions" value={profile.solution_count} />
                    <Stat label="Accepted" value={profile.accepted_count} />
                </div>
            </section>

            <section className="mt-6">
                <h2 className="font-semibold text-slate-900">Problems</h2>
                {profile.problems.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No problems posted yet.</p>
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
                                    {p.category} · {p.status === "resolved" ? "Resolved" : "Open"} · {formatDate(p.created_at)}
                                </p>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            <section className="mt-6">
                <h2 className="font-semibold text-slate-900">Solutions</h2>
                {profile.solutions.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No solutions submitted yet.</p>
                ) : (
                    <div className="mt-2 space-y-2">
                        {profile.solutions.map((s) => (
                            <Link
                                key={s.id}
                                to={`/problems/${s.problem_id}`}
                                className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-brand-300"
                            >
                                <p className="text-xs text-slate-500">
                                    On: <span className="font-medium text-slate-700">{s.problem_title}</span>
                                    {s.status === "accepted" && (
                                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                                            Accepted
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
