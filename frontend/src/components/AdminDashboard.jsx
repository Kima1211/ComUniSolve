import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet, apiPatch } from "../api";
import { useLanguage } from "../i18n/language-context";
import Layout, { TierBadge } from "./Layout";
import BackLink from "./BackLink";

const PAGE_SIZE = 50

function StatCard({ label, value, highlight }) {
    return (
        <div className={`rounded-xl border bg-white p-6 ${highlight && value > 0 ? "border-amber-300" : "border-slate-200"}`}>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <p className={`mt-2 text-3xl font-bold tracking-tight ${highlight && value > 0 ? "text-amber-700" : "text-slate-900"}`}>
                {value}
            </p>
        </div>
    )
}

function Badge({ children, tone = "slate" }) {
    const tones = {
        slate: "bg-slate-100 text-slate-700",
        amber: "bg-amber-100 text-amber-800",
        red: "bg-red-100 text-red-800",
        purple: "bg-purple-100 text-purple-800",
        green: "bg-emerald-100 text-emerald-800",
        sky: "bg-sky-100 text-sky-800",
    }
    return (
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
    )
}

// error is an error object (translated on render), notice is ready-made text.
function Message({ error, notice }) {
    const { errorText } = useLanguage()
    return (
        <>
            {error && (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorText(error)}</p>
            )}
            {notice && (
                <p className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{notice}</p>
            )}
        </>
    )
}

function QueueRow({ item, onAction, busy }) {
    const { t, label } = useLanguage()
    const reported = item.report_count > 0
    const reasons = item.report_reasons.map((r) => label("report.reason", r)).join(", ")

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
                <Badge tone="slate">{label("admin.type", item.target_type)}</Badge>
                {reported && (
                    <Badge tone="red">{t("admin.reports", { count: item.report_count })}</Badge>
                )}
                {item.moderation_status === "flagged" && <Badge tone="amber">{t("admin.flagged")}</Badge>}
                {item.ai_status !== "unchecked" && item.ai_status !== "ok" && (
                    <Badge tone="purple">{t("admin.ai", { status: label("admin.aiStatus", item.ai_status) })}</Badge>
                )}
                {item.ai_status === "unchecked" && <Badge tone="slate">{t("admin.aiNotChecked")}</Badge>}
            </div>

            {item.problem_title && (
                <p className="mt-2 text-xs text-slate-500">
                    {item.target_type === "comment" ? t("admin.commentUnder") : t("admin.answerTo")}{" "}
                    <a href={`/problems/${item.problem_id}`} target="_blank" rel="noreferrer"
                       className="font-medium text-brand-700 hover:underline">
                        {item.problem_title}
                    </a>
                </p>
            )}
            {item.title && <p className="mt-2 font-semibold text-slate-900">{item.title}</p>}
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.excerpt}</p>

            <p className="mt-2 text-xs text-slate-500">
                {t("admin.byAuthor", { name: item.author_name, id: item.author_id })}
                {reported && <> · {t("admin.reportedFor", { reasons })}</>}
                {item.problem_id && (
                    <> · <a href={`/problems/${item.problem_id}`} target="_blank" rel="noreferrer"
                            className="font-medium text-brand-700 hover:underline">{t("admin.viewOnSite")}</a></>
                )}
            </p>

            {item.reports.some((r) => r.details) && (
                <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                    {item.reports.filter((r) => r.details).map((r, i) => (
                        <li key={i}>
                            <span className="font-medium">{label("report.reason", r.reason)}:</span> {r.details}
                        </li>
                    ))}
                </ul>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
                <button
                    type="button" disabled={busy}
                    onClick={() => onAction(item, "approved")}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs
                               font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                >
                    {t("admin.approve")}
                </button>
                <button
                    type="button" disabled={busy}
                    onClick={() => {
                        const reason = window.prompt(t("admin.promptRemove"))
                        if (reason === null) return
                        onAction(item, "removed", reason)
                    }}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs
                               font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                >
                    {t("admin.remove")}
                </button>
                <button
                    type="button" disabled={busy}
                    onClick={() => {
                        const reason = window.prompt(t("admin.promptRemoveNoPenalty"))
                        if (reason === null) return
                        onAction(item, "removed_no_penalty", reason)
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs
                               font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    title={t("admin.removeNoPenaltyTitle")}
                >
                    {t("admin.removeNoPenalty")}
                </button>
            </div>
        </div>
    )
}

function OverviewTab() {
    const navigate = useNavigate()
    const { t } = useLanguage()

    const [error, setError] = useState(null)
    const [notice, setNotice] = useState("")
    const [total, setTotal] = useState(null)
    const [queue, setQueue] = useState([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    const fetchAll = useCallback(
        () => Promise.all([apiGet("/admin/overview"), apiGet("/admin/queue")]),
        [],
    )

    useEffect(() => {
        let cancelled = false
        fetchAll()
            .then(([overview, items]) => {
                if (cancelled) return
                setTotal(overview)
                setQueue(items)
            })
            .catch((e) => {
                if (cancelled) return
                if (e.status === 401) { navigate("/login"); return }
                setError(e)
            })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [fetchAll, navigate])

    async function reload() {
        const [overview, items] = await fetchAll()
        setTotal(overview)
        setQueue(items)
    }

    async function handleAction(item, action, reason) {
        try {
            setBusy(true)
            setError(null)
            // problem -> /admin/problems/..., solution -> /admin/solutions/..., comment -> /admin/comments/...
            const path = `/admin/${item.target_type}s/${item.id}/moderate`
            const result = await apiPatch(path, { action, reason: reason || null })

            if (action === "removed") {
                let msg = t("admin.removedPoints", { name: item.author_name, points: result.points_after })
                if (result.suspended) {
                    msg += result.suspended_days
                        ? t("admin.removedSuspendedDays", { count: result.suspended_days })
                        : t("admin.removedSuspendedForever")
                } else {
                    msg += t("admin.removalsTotal", { count: result.removals })
                }
                setNotice(msg)
            } else if (action === "removed_no_penalty") {
                setNotice(t("admin.removedNoPenalty", { name: item.author_name, points: result.points_after }))
            } else {
                setNotice(t("admin.done"))
            }

            await reload()
        } catch (e) {
            setError(e.code ? e : { key: "admin.couldNotAct" })
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
            {loading && (
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-white" />)}
                </div>
            )}

            <Message error={error} notice={notice} />

            {total && (
                <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    <StatCard label={t("admin.stat.users")} value={total.total_users} />
                    <StatCard label={t("admin.stat.problems")} value={total.total_problems} />
                    <StatCard label={t("admin.stat.solutions")} value={total.total_solutions} />
                    <StatCard label={t("admin.stat.pending")} value={total.pending_reports ?? 0} highlight />
                    <StatCard label={t("admin.stat.flagged")} value={total.flagged_content ?? 0} highlight />
                </div>
            )}

            <h2 className="mt-10 text-lg font-bold text-slate-900">{t("admin.queue")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("admin.queueHint")}</p>

            {!loading && queue.length === 0 && (
                <p className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                    {t("admin.queueEmpty")}
                </p>
            )}

            <div className="mt-4 space-y-3">
                {queue.map((item) => (
                    <QueueRow
                        key={`${item.target_type}-${item.id}`}
                        item={item}
                        onAction={handleAction}
                        busy={busy}
                    />
                ))}
            </div>
        </>
    )
}

const USER_FILTERS = ["all", "suspended", "unverified", "admins"]

function UserStatus({ u }) {
    const { t, formatDate } = useLanguage()
    return (
        <div className="flex flex-wrap gap-1">
            {u.role === "admin" && <Badge tone="purple">{t("admin.badge.admin")}</Badge>}
            {!u.is_active && <Badge tone="slate">{t("admin.badge.deactivated")}</Badge>}
            {u.is_verified
                ? <Badge tone="green">{t("admin.badge.verified")}</Badge>
                : <Badge tone="amber">{t("admin.badge.unverified")}</Badge>}
            {u.is_suspended && (
                <Badge tone="red">
                    {u.suspended_until
                        ? t("admin.suspendedUntil", { date: formatDate(u.suspended_until) })
                        : t("admin.permSuspended")}
                </Badge>
            )}
        </div>
    )
}

function UsersTab() {
    const { t, formatDate } = useLanguage()
    const [search, setSearch] = useState("")
    const [show, setShow] = useState("all")
    const [page, setPage] = useState(0)
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [notice, setNotice] = useState("")
    const [busyId, setBusyId] = useState(null)
    const [reloadKey, setReloadKey] = useState(0)

    useEffect(() => {
        let cancelled = false
        const timer = setTimeout(() => {
            setLoading(true)
            const params = new URLSearchParams({
                search, show, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
            })
            apiGet(`/admin/users?${params}`)
                .then((d) => { if (!cancelled) { setData(d); setError(null) } })
                .catch((e) => { if (!cancelled) setError(e.code ? e : { key: "admin.couldNotLoadUsers" }) })
                .finally(() => { if (!cancelled) setLoading(false) })
        }, 300)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [search, show, page, reloadKey])

    async function changeSuspension(u, suspend) {
        const reason = window.prompt(
            suspend ? t("admin.promptSuspend", { name: u.name }) : t("admin.promptUnsuspend", { name: u.name })
        )
        if (reason === null) return
        if (suspend && !reason.trim()) {
            setError({ key: "admin.reasonRequired" })
            return
        }

        try {
            setBusyId(u.id)
            setError(null)
            const result = await apiPatch(`/admin/users/${u.id}/suspension`, {
                suspend, reason: reason.trim() || null,
            })
            if (!suspend) {
                setNotice(t("admin.unsuspendedMsg", { name: u.name }))
            } else if (result.days) {
                setNotice(t("admin.suspendedFor", { name: u.name, count: result.days }))
            } else {
                setNotice(t("admin.suspendedForever", { name: u.name }))
            }
            setReloadKey((k) => k + 1)
        } catch (e) {
            setError(e.code ? e : { key: "admin.couldNotSuspend" })
        } finally {
            setBusyId(null)
        }
    }

    const total = data?.total ?? 0
    const from = total === 0 ? 0 : page * PAGE_SIZE + 1
    const to = Math.min((page + 1) * PAGE_SIZE, total)

    return (
        <>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                    type="search"
                    placeholder={t("admin.search")}
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none
                               focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 sm:max-w-xs"
                />
                <div className="flex flex-wrap gap-2">
                    {USER_FILTERS.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => { setShow(value); setPage(0) }}
                            className={`rounded-full px-3 py-1 text-sm font-medium ${
                                show === value
                                    ? "bg-brand-600 text-white"
                                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                        >
                            {t(`admin.filter.${value}`)}
                        </button>
                    ))}
                </div>
            </div>

            <Message error={error} notice={notice} />

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                            <th className="px-4 py-3 font-medium">{t("admin.col.user")}</th>
                            <th className="px-4 py-3 font-medium">{t("admin.col.reputation")}</th>
                            <th className="px-4 py-3 font-medium">{t("admin.col.posts")}</th>
                            <th className="px-4 py-3 font-medium">{t("admin.col.removed")}</th>
                            <th className="px-4 py-3 font-medium">{t("admin.col.status")}</th>
                            <th className="px-4 py-3 font-medium">{t("admin.col.joined")}</th>
                            <th className="px-4 py-3 font-medium"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data?.users.map((u) => (
                            <tr key={u.id} className={loading ? "opacity-50" : ""}>
                                <td className="px-4 py-3">
                                    <p className="font-medium text-slate-900">{u.name}</p>
                                    <p className="text-xs text-slate-500">{u.email}</p>
                                </td>
                                <td className="px-4 py-3">
                                    <TierBadge tier={u.tier} />
                                    <p className="mt-1 text-xs text-slate-500">{t("admin.pts", { points: u.points })}</p>
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                    {t("admin.problemCount", { count: u.problem_count })}
                                    <br />
                                    {t("common.solutions", { count: u.solution_count })}
                                </td>
                                <td className={`px-4 py-3 ${u.removal_count > 0 ? "font-semibold text-red-700" : "text-slate-500"}`}>
                                    {u.removal_count}
                                </td>
                                <td className="px-4 py-3">
                                    <UserStatus u={u} />
                                    {u.is_suspended && u.suspension_reason && (
                                        <p className="mt-1 text-xs text-slate-500">{u.suspension_reason}</p>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">
                                    {formatDate(u.created_at)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {u.role !== "admin" && (
                                        u.is_suspended ? (
                                            <button
                                                type="button"
                                                disabled={busyId === u.id}
                                                onClick={() => changeSuspension(u, false)}
                                                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs
                                                           font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                                            >
                                                {t("admin.unsuspend")}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={busyId === u.id}
                                                onClick={() => changeSuspension(u, true)}
                                                className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs
                                                           font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                                            >
                                                {t("admin.suspend")}
                                            </button>
                                        )
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {!loading && data && data.users.length === 0 && (
                    <p className="p-6 text-center text-sm text-slate-500">{t("admin.noUsers")}</p>
                )}
                {loading && !data && (
                    <p className="p-6 text-center text-sm text-slate-500">{t("admin.loadingUsers")}</p>
                )}
            </div>

            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                <span>{total > 0 ? t("admin.showing", { from, to, total }) : ""}</span>
                <div className="flex gap-2">
                    <button
                        type="button"
                        disabled={page === 0 || loading}
                        onClick={() => setPage((p) => p - 1)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                    >
                        {t("admin.previous")}
                    </button>
                    <button
                        type="button"
                        disabled={to >= total || loading}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                    >
                        {t("admin.next")}
                    </button>
                </div>
            </div>
        </>
    )
}

const LOG_FILTERS = ["", "removed", "removed_no_penalty", "restored", "suspended", "unsuspended"]

const ACTION_TONES = {
    removed: "red",
    removed_no_penalty: "slate",
    restored: "green",
    suspended: "amber",
    unsuspended: "sky",
}

function ActivityTab() {
    const { t, label, formatDateTime } = useLanguage()
    const [action, setAction] = useState("")
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [notice, setNotice] = useState("")
    const [busyId, setBusyId] = useState(null)
    const [reloadKey, setReloadKey] = useState(0)

    useEffect(() => {
        let cancelled = false
        const timer = setTimeout(() => {
            setLoading(true)
            const params = new URLSearchParams({ limit: 200 })
            if (action) params.set("action", action)
            apiGet(`/admin/logs?${params}`)
                .then((d) => { if (!cancelled) { setLogs(d); setError(null) } })
                .catch((e) => { if (!cancelled) setError(e.code ? e : { key: "admin.couldNotLoadLog" }) })
                .finally(() => { if (!cancelled) setLoading(false) })
        }, 0)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [action, reloadKey])

    function describe(log) {
        const params = {
            who: log.admin_name || t("admin.log.automatic"),
            target: log.target_user_name || t("admin.log.deletedUser"),
            type: label("admin.type", log.target_type),
            action: label("admin.action", log.action),
        }
        const known = ["suspended", "unsuspended", "removed", "removed_no_penalty", "restored"]
        return t(known.includes(log.action) ? `admin.log.${log.action}` : "admin.log.other", params)
    }

    async function restore(log) {
        const reason = window.prompt(t("admin.promptRestore"))
        if (reason === null) return

        const path = log.problem_id
            ? `/admin/problems/${log.problem_id}/moderate`
            : log.solution_id
                ? `/admin/solutions/${log.solution_id}/moderate`
                : `/admin/comments/${log.comment_id}/moderate`
        try {
            setBusyId(log.id)
            setError(null)
            const result = await apiPatch(path, { action: "restored", reason: reason.trim() || null })
            setNotice(t("admin.restoredMsg", {
                name: log.target_user_name || t("admin.theAuthor"), points: result.points_after,
            }))
            setReloadKey((k) => k + 1)
        } catch (e) {
            setError(e.code ? e : { key: "admin.couldNotRestore" })
        } finally {
            setBusyId(null)
        }
    }

    return (
        <>
            <div className="mt-6">
                <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none
                               focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                >
                    {LOG_FILTERS.map((value) => (
                        <option key={value} value={value}>{t(`admin.action.${value || "all"}`)}</option>
                    ))}
                </select>
            </div>

            <Message error={error} notice={notice} />

            {!loading && logs.length === 0 && (
                <p className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                    {t("admin.noActivity")}
                </p>
            )}

            <div className={`mt-4 space-y-3 ${loading ? "opacity-50" : ""}`}>
                {logs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={ACTION_TONES[log.action] || "slate"}>{label("admin.action", log.action)}</Badge>
                            <span className="text-sm text-slate-900">{describe(log)}</span>
                            <span className="ml-auto text-xs text-slate-500">{formatDateTime(log.created_at)}</span>
                        </div>

                        {log.reason && (
                            <p className="mt-2 text-sm text-slate-600">
                                <span className="font-medium text-slate-700">{t("admin.reason")}</span> {log.reason}
                            </p>
                        )}

                        {log.content_snapshot && (
                            <details className="mt-2 text-sm">
                                <summary className="cursor-pointer text-slate-500 hover:text-slate-800">
                                    {t("admin.showContent")}
                                </summary>
                                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-700">
                                    {log.content_snapshot}
                                </p>
                            </details>
                        )}

                        {(log.action === "removed" || log.action === "removed_no_penalty") && log.target_status === "removed" && (
                            <button
                                type="button"
                                disabled={busyId === log.id}
                                onClick={() => restore(log)}
                                className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs
                                           font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                            >
                                {t("admin.restore")}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </>
    )
}

const AUDIT_ACTIONS = [
    "login_success", "login_failed", "register", "email_verified",
    "password_reset", "profile_updated", "account_deactivated",
]

const AUDIT_TONES = {
    login_failed: "red",
    account_deactivated: "amber",
    register: "green",
    email_verified: "green",
    password_reset: "sky",
    profile_updated: "sky",
}

// Account activity (sign-ups, logins, failed logins, profile changes) - separate from moderation.
function AccountsTab() {
    const { t, formatDateTime } = useLanguage()
    const [action, setAction] = useState("")
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    useEffect(() => {
        let cancelled = false
        const timer = setTimeout(() => {
            setLoading(true)
            const params = new URLSearchParams({ limit: 200 })
            if (action) params.set("action", action)
            apiGet(`/admin/audit?${params}`)
                .then((d) => { if (!cancelled) { setLogs(d); setError(null) } })
                .catch((e) => { if (!cancelled) setError(e.code ? e : { key: "admin.couldNotLoadAudit" }) })
                .finally(() => { if (!cancelled) setLoading(false) })
        }, 0)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [action])

    return (
        <>
            <div className="mt-6">
                <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none
                               focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                >
                    <option value="">{t("admin.audit.all")}</option>
                    {AUDIT_ACTIONS.map((value) => <option key={value} value={value}>{t(`admin.audit.${value}`)}</option>)}
                </select>
            </div>

            <Message error={error} />

            {!loading && logs.length === 0 && (
                <p className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                    {t("admin.audit.empty")}
                </p>
            )}

            <div className={`mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white ${loading ? "opacity-50" : ""}`}>
                {logs.map((log) => (
                    <div key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                        <Badge tone={AUDIT_TONES[log.action] || "slate"}>{t(`admin.audit.${log.action}`)}</Badge>
                        <span className="text-slate-900">{log.user_name || log.email || t("admin.audit.unknown")}</span>
                        {log.user_name && log.email && <span className="text-xs text-slate-500">{log.email}</span>}
                        <span className="ml-auto flex gap-3 text-xs text-slate-500">
                            {log.ip && <span>{t("admin.audit.ip", { ip: log.ip })}</span>}
                            <span>{formatDateTime(log.created_at)}</span>
                        </span>
                    </div>
                ))}
            </div>
        </>
    )
}

const TABS = ["overview", "users", "activity", "accounts"]

function AdminDashboard() {
    const { t } = useLanguage()
    const [params, setParams] = useSearchParams()
    const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "overview"

    return (
        <Layout>
            <BackLink />
            <h1 className="mt-4 text-xl font-bold text-slate-900">{t("admin.title")}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("admin.subtitle")}</p>

            <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
                {TABS.map((value) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setParams(value === "overview" ? {} : { tab: value })}
                        className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
                            tab === value
                                ? "border-brand-600 text-brand-700"
                                : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        {t(`admin.tab.${value}`)}
                    </button>
                ))}
            </div>

            {tab === "overview" && <OverviewTab />}
            {tab === "users" && <UsersTab />}
            {tab === "activity" && <ActivityTab />}
            {tab === "accounts" && <AccountsTab />}
        </Layout>
    )
}

export default AdminDashboard
