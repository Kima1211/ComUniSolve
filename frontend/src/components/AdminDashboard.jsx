import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet, apiPatch } from "../api";
import Layout, { TierBadge } from "./Layout";

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

function Message({ error, notice }) {
    return (
        <>
            {error && (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            {notice && (
                <p className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{notice}</p>
            )}
        </>
    )
}

function formatDate(value) {
    return value ? new Date(value).toLocaleString() : ""
}

function QueueRow({ item, onAction, busy }) {
    const reported = item.report_count > 0

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
                <Badge tone="slate">{item.target_type}</Badge>
                {reported && (
                    <Badge tone="red">
                        {item.report_count} report{item.report_count === 1 ? "" : "s"}
                    </Badge>
                )}
                {item.moderation_status === "flagged" && <Badge tone="amber">flagged</Badge>}
                {item.ai_status !== "unchecked" && item.ai_status !== "ok" && (
                    <Badge tone="purple">AI: {item.ai_status}</Badge>
                )}
                {item.ai_status === "unchecked" && <Badge tone="slate">AI: not checked</Badge>}
            </div>

            {item.title && <p className="mt-2 font-semibold text-slate-900">{item.title}</p>}
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.excerpt}</p>

            <p className="mt-2 text-xs text-slate-500">
                by {item.author_name} (#{item.author_id})
                {reported && <> · reported for {item.report_reasons.join(", ")}</>}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
                <button
                    type="button" disabled={busy}
                    onClick={() => onAction(item, "approved")}
                    className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs
                               font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                >
                    Approve
                </button>
                <button
                    type="button" disabled={busy}
                    onClick={() => {
                        const reason = window.prompt("Reason for removing this? (optional)") ?? ""
                        onAction(item, "removed", reason)
                    }}
                    className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs
                               font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                >
                    Remove
                </button>
                {reported && (
                    <button
                        type="button" disabled={busy}
                        onClick={() => onAction(item, "dismissed")}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                    >
                        Dismiss reports
                    </button>
                )}
            </div>
        </div>
    )
}

function OverviewTab() {
    const navigate = useNavigate()

    const [error, setError] = useState("")
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
                setError(e.message || "Something went wrong! Please try again.")
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
            setError("")
            const path = item.target_type === "problem"
                ? `/admin/problems/${item.id}/moderate`
                : `/admin/solutions/${item.id}/moderate`
            const result = await apiPatch(path, { action, reason: reason || null })

            if (action === "removed") {
                let msg = `Removed. ${item.author_name} is now on ${result.points_after} points`
                if (result.suspended) {
                    msg += result.suspended_days
                        ? ` and is suspended for ${result.suspended_days} day${result.suspended_days === 1 ? "" : "s"}.`
                        : " and is permanently suspended."
                } else {
                    msg += ` (${result.removals} removal${result.removals === 1 ? "" : "s"} total).`
                }
                setNotice(msg)
            } else {
                setNotice("Done.")
            }

            await reload()
        } catch (e) {
            setError(e.message || "Could not apply that action.")
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
                    <StatCard label="Total users" value={total.total_users} />
                    <StatCard label="Total problems" value={total.total_problems} />
                    <StatCard label="Total solutions" value={total.total_solutions} />
                    <StatCard label="Pending reports" value={total.pending_reports ?? 0} highlight />
                    <StatCard label="Flagged content" value={total.flagged_content ?? 0} highlight />
                </div>
            )}

            <h2 className="mt-10 text-lg font-bold text-slate-900">Moderation queue</h2>
            <p className="mt-1 text-sm text-slate-500">
                Content flagged automatically or reported by the community. Most-reported first.
            </p>

            {!loading && queue.length === 0 && (
                <p className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                    Nothing is waiting for review.
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

const USER_FILTERS = [
    ["all", "All"],
    ["suspended", "Suspended"],
    ["unverified", "Unverified"],
    ["admins", "Admins"],
]

function UserStatus({ u }) {
    return (
        <div className="flex flex-wrap gap-1">
            {u.role === "admin" && <Badge tone="purple">admin</Badge>}
            {u.is_verified ? <Badge tone="green">verified</Badge> : <Badge tone="amber">unverified</Badge>}
            {u.is_suspended && (
                <Badge tone="red">
                    {u.suspended_until
                        ? `suspended until ${new Date(u.suspended_until).toLocaleDateString()}`
                        : "permanently suspended"}
                </Badge>
            )}
        </div>
    )
}

function UsersTab() {
    const [search, setSearch] = useState("")
    const [show, setShow] = useState("all")
    const [page, setPage] = useState(0)
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
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
                .then((d) => { if (!cancelled) { setData(d); setError("") } })
                .catch((e) => { if (!cancelled) setError(e.message || "Could not load users.") })
                .finally(() => { if (!cancelled) setLoading(false) })
        }, 300)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [search, show, page, reloadKey])

    async function changeSuspension(u, suspend) {
        const reason = window.prompt(
            suspend
                ? `Why are you suspending ${u.name}? (required)`
                : `Why are you lifting ${u.name}'s suspension? (optional)`
        )
        if (reason === null) return
        if (suspend && !reason.trim()) {
            setError("A reason is required to suspend someone.")
            return
        }

        try {
            setBusyId(u.id)
            setError("")
            const result = await apiPatch(`/admin/users/${u.id}/suspension`, {
                suspend, reason: reason.trim() || null,
            })
            if (!suspend) {
                setNotice(`${u.name}'s suspension was lifted.`)
            } else if (result.days) {
                setNotice(`${u.name} is suspended for ${result.days} day${result.days === 1 ? "" : "s"}.`)
            } else {
                setNotice(`${u.name} is permanently suspended.`)
            }
            setReloadKey((k) => k + 1)
        } catch (e) {
            setError(e.message || "Could not update the suspension.")
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
                    placeholder="Search by name or email"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0) }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none
                               focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 sm:max-w-xs"
                />
                <div className="flex flex-wrap gap-2">
                    {USER_FILTERS.map(([value, label]) => (
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
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <Message error={error} notice={notice} />

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                        <tr>
                            <th className="px-4 py-3 font-medium">User</th>
                            <th className="px-4 py-3 font-medium">Reputation</th>
                            <th className="px-4 py-3 font-medium">Posts</th>
                            <th className="px-4 py-3 font-medium">Removed</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Joined</th>
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
                                    <p className="mt-1 text-xs text-slate-500">{u.points} pts</p>
                                </td>
                                <td className="px-4 py-3 text-slate-700">
                                    {u.problem_count} problems
                                    <br />
                                    {u.solution_count} solutions
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
                                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}
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
                                                Unsuspend
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={busyId === u.id}
                                                onClick={() => changeSuspension(u, true)}
                                                className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs
                                                           font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                                            >
                                                Suspend
                                            </button>
                                        )
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {!loading && data && data.users.length === 0 && (
                    <p className="p-6 text-center text-sm text-slate-500">No users match.</p>
                )}
                {loading && !data && (
                    <p className="p-6 text-center text-sm text-slate-500">Loading users...</p>
                )}
            </div>

            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                <span>{total > 0 ? `Showing ${from}–${to} of ${total}` : ""}</span>
                <div className="flex gap-2">
                    <button
                        type="button"
                        disabled={page === 0 || loading}
                        onClick={() => setPage((p) => p - 1)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                    >
                        Previous
                    </button>
                    <button
                        type="button"
                        disabled={to >= total || loading}
                        onClick={() => setPage((p) => p + 1)}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            </div>
        </>
    )
}

const LOG_FILTERS = [
    ["", "All actions"],
    ["removed", "Removed"],
    ["restored", "Restored"],
    ["suspended", "Suspended"],
    ["unsuspended", "Unsuspended"],
]

const ACTION_TONES = {
    removed: "red",
    restored: "green",
    suspended: "amber",
    unsuspended: "sky",
}

function describe(log) {
    const who = log.admin_name || "Automatic"
    const target = log.target_user_name || "a deleted user"
    if (log.action === "suspended") return `${who} suspended ${target}`
    if (log.action === "unsuspended") return `${who} lifted ${target}'s suspension`
    return `${who} ${log.action} a ${log.target_type} by ${target}`
}

function ActivityTab() {
    const [action, setAction] = useState("")
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")
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
                .then((d) => { if (!cancelled) { setLogs(d); setError("") } })
                .catch((e) => { if (!cancelled) setError(e.message || "Could not load the activity log.") })
                .finally(() => { if (!cancelled) setLoading(false) })
        }, 0)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [action, reloadKey])

    async function restore(log) {
        const reason = window.prompt("Why are you restoring this? (optional)")
        if (reason === null) return

        const path = log.problem_id
            ? `/admin/problems/${log.problem_id}/moderate`
            : `/admin/solutions/${log.solution_id}/moderate`
        try {
            setBusyId(log.id)
            setError("")
            const result = await apiPatch(path, { action: "restored", reason: reason.trim() || null })
            setNotice(`Restored. ${log.target_user_name || "The author"} is now on ${result.points_after} points.`)
            setReloadKey((k) => k + 1)
        } catch (e) {
            setError(e.message || "Could not restore this.")
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
                    {LOG_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
            </div>

            <Message error={error} notice={notice} />

            {!loading && logs.length === 0 && (
                <p className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
                    No moderation activity yet.
                </p>
            )}

            <div className={`mt-4 space-y-3 ${loading ? "opacity-50" : ""}`}>
                {logs.map((log) => (
                    <div key={log.id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={ACTION_TONES[log.action] || "slate"}>{log.action}</Badge>
                            <span className="text-sm text-slate-900">{describe(log)}</span>
                            <span className="ml-auto text-xs text-slate-500">{formatDate(log.created_at)}</span>
                        </div>

                        {log.reason && (
                            <p className="mt-2 text-sm text-slate-600">
                                <span className="font-medium text-slate-700">Reason:</span> {log.reason}
                            </p>
                        )}

                        {log.content_snapshot && (
                            <details className="mt-2 text-sm">
                                <summary className="cursor-pointer text-slate-500 hover:text-slate-800">
                                    Show the content
                                </summary>
                                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-slate-700">
                                    {log.content_snapshot}
                                </p>
                            </details>
                        )}

                        {log.action === "removed" && log.target_status === "removed" && (
                            <button
                                type="button"
                                disabled={busyId === log.id}
                                onClick={() => restore(log)}
                                className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs
                                           font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                            >
                                Restore
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </>
    )
}

const TABS = [
    ["overview", "Overview"],
    ["users", "Users"],
    ["activity", "Activity log"],
]

function AdminDashboard() {
    const [params, setParams] = useSearchParams()
    const tab = TABS.some(([value]) => value === params.get("tab")) ? params.get("tab") : "overview"

    return (
        <Layout>
            <h1 className="text-xl font-bold text-slate-900">Admin dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">Statistics, user management, and moderation monitoring.</p>

            <div className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
                {TABS.map(([value, label]) => (
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
                        {label}
                    </button>
                ))}
            </div>

            {tab === "overview" && <OverviewTab />}
            {tab === "users" && <UsersTab />}
            {tab === "activity" && <ActivityTab />}
        </Layout>
    )
}

export default AdminDashboard
