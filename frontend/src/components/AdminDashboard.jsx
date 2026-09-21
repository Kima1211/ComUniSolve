import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPatch } from "../api";
import Layout from "./Layout";

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
    }
    return (
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>
    )
}

function QueueRow({ item, onAction, busy }) {
    // Why is this here? Answering that is the admin's first question, so it is
    // the first thing on the row.
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

function AdminDashboard() {
    const navigate = useNavigate()

    const [error, setError] = useState("")
    const [notice, setNotice] = useState("")
    const [total, setTotal] = useState(null)
    const [queue, setQueue] = useState([])
    const [loading, setLoading] = useState(true)
    const [busy, setBusy] = useState(false)

    // Fetching and state-setting are kept apart on purpose: this returns data
    // and touches no state, so it is safe to call from an effect without
    // triggering a cascading render.
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

            // Refetch rather than editing the list locally - the server decides
            // what is still in the queue, and a removal can change more than
            // the one row that was clicked.
            await reload()
        } catch (e) {
            setError(e.message || "Could not apply that action.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <Layout>
            <h1 className="text-xl font-bold text-slate-900">Admin dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">Live counts, and everything waiting for review.</p>

            {loading && (
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-white" />)}
                </div>
            )}

            {error && (
                <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            {notice && (
                <p className="mt-6 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">{notice}</p>
            )}

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
        </Layout>
    )
}

export default AdminDashboard
