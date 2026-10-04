import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiGet, apiPatch } from "../api";
import { useLanguage } from "../i18n/language-context";
import { inputClass } from "../form";
import { useConfirm } from "../confirm-context";
import { Ban, EyeOff, RotateCcw, UserCheck } from "lucide-react";
import { alertError, alertNote, btnDanger, btnGhost, btnSecondary, btnSmall, chip, pageSub, pageTitle } from "../ui";
import Layout, { TierBadge } from "./Layout";
import BackLink from "./BackLink";

const PAGE_SIZE = 50

function Stat({ label, value, highlight }) {
    const attention = highlight && value > 0
    return (
        <div>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className={`text-[22px] font-semibold tabular-nums ${attention ? "text-link" : "text-ink"}`}>{value}</dd>
        </div>
    )
}

const BADGE_TONES = {
    slate: "bg-surface-2 text-muted",
    purple: "bg-surface-2 text-ink",
    green: "bg-surface-2 text-ink",
    sky: "bg-primary-soft text-link",
    amber: "bg-primary-soft text-link",
    red: "bg-error-soft text-error",
}

function Badge({ children, tone = "slate" }) {
    return <span className={`${chip} ${BADGE_TONES[tone] || BADGE_TONES.slate}`}>{children}</span>
}

function Message({ error, notice }) {
    const { errorText } = useLanguage()
    return (
        <>
            {error && (
                <p role="alert" className={`${alertError} mt-4`}>{errorText(error)}</p>
            )}
            {notice && (
                <p role="status" className={`${alertNote} mt-4`}>{notice}</p>
            )}
        </>
    )
}

function QueueRow({ item, onAction, busy }) {
    const { t, label } = useLanguage()
    const confirm = useConfirm()

    async function askAndAct(action) {
        const noPenalty = action === "removed_no_penalty"
        const ok = await confirm({
            title: noPenalty ? t("confirm.removeNoPenalty.title") : t("confirm.remove.title"),
            body: noPenalty ? t("confirm.removeNoPenalty.body") : t("confirm.remove.body"),
            preview: item.title || item.excerpt,
            confirmLabel: noPenalty ? t("admin.removeNoPenalty") : t("admin.remove"),
            Icon: EyeOff,
            reason: { label: t("confirm.reasonLabel") },
        })
        if (ok) onAction(item, action, ok.reason)
    }
    const reported = item.report_count > 0
    const reasons = item.report_reasons.map((r) => label("report.reason", r)).join(", ")

    return (
        <div className="p-4">
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
                <p className="mt-2 text-xs text-muted">
                    {item.target_type === "comment" ? t("admin.commentUnder") : t("admin.answerTo")}{" "}
                    <a href={`/problems/${item.problem_id}`} target="_blank" rel="noreferrer"
                       className="font-medium text-link hover:underline">
                        {item.problem_title}
                    </a>
                </p>
            )}
            {item.title && <p className="mt-2 text-[17px] font-semibold leading-snug text-ink">{item.title}</p>}
            <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{item.excerpt}</p>

            <p className="mt-2 text-xs text-muted">
                {t("admin.byAuthor", { name: item.author_name, id: item.author_id })}
                {reported && <> · {t("admin.reportedFor", { reasons })}</>}
                {item.problem_id && (
                    <> · <a href={`/problems/${item.problem_id}`} target="_blank" rel="noreferrer"
                            className="font-medium text-link hover:underline">{t("admin.viewOnSite")}</a></>
                )}
            </p>

            {item.reports.some((r) => r.details) && (
                <ul className="mt-2 space-y-1 rounded-md bg-surface-2 p-2 text-xs text-ink">
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
                    className={`${btnSecondary} ${btnSmall}`}
                >
                    {t("admin.approve")}
                </button>
                <button
                    type="button" disabled={busy}
                    onClick={() => askAndAct("removed")}
                    className={`${btnDanger} ${btnSmall}`}
                >
                    {t("admin.remove")}
                </button>
                <button
                    type="button" disabled={busy}
                    onClick={() => askAndAct("removed_no_penalty")}
                    className={`${btnGhost} ${btnSmall}`}
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
                <div className="mt-6 h-16 animate-pulse rounded-lg border border-border bg-surface" />
            )}

            <Message error={error} notice={notice} />

            {total && (
                <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-3 lg:grid-cols-5">
                    <Stat label={t("admin.stat.users")} value={total.total_users} />
                    <Stat label={t("admin.stat.problems")} value={total.total_problems} />
                    <Stat label={t("admin.stat.solutions")} value={total.total_solutions} />
                    <Stat label={t("admin.stat.pending")} value={total.pending_reports ?? 0} highlight />
                    <Stat label={t("admin.stat.flagged")} value={total.flagged_content ?? 0} highlight />
                </dl>
            )}

            <h2 className="mt-8 text-base font-semibold text-ink">{t("admin.queue")}</h2>
            <p className="mt-1 text-sm text-muted">{t("admin.queueHint")}</p>

            {!loading && queue.length === 0 && (
                <p className="mt-4 rounded-lg border border-border bg-surface p-6 text-sm text-muted">
                    {t("admin.queueEmpty")}
                </p>
            )}

            {queue.length > 0 && (
            <div className="mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
                {queue.map((item) => (
                    <QueueRow
                        key={`${item.target_type}-${item.id}`}
                        item={item}
                        onAction={handleAction}
                        busy={busy}
                    />
                ))}
            </div>
            )}
        </>
    )
}

const USER_FILTERS = ["all", "suspended", "unverified", "admins"]

function UserStatus({ u }) {
    const { t, formatDate } = useLanguage()
    return (
        <div className="flex flex-wrap gap-1">
            {u.role === "admin" && <Badge tone="purple">{t("admin.badge.admin")}</Badge>}
            {u.is_deleted
                ? <Badge tone="red">{t("admin.badge.deleted")}</Badge>
                : !u.is_active && <Badge tone="slate">{t("admin.badge.deactivated")}</Badge>}
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
    const confirm = useConfirm()
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
        const ok = await confirm({
            title: suspend ? t("confirm.suspend.title", { name: u.name }) : t("confirm.unsuspend.title", { name: u.name }),
            body: suspend ? t("confirm.suspend.body") : t("confirm.unsuspend.body"),
            confirmLabel: suspend ? t("admin.suspend") : t("admin.unsuspend"),
            tone: suspend ? "danger" : "primary",
            Icon: suspend ? Ban : UserCheck,
            reason: { label: t("confirm.reasonLabel"), required: suspend },
        })
        if (!ok) return
        const reason = ok.reason

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

    async function reactivate(u) {
        const ok = await confirm({
            title: t("confirm.reactivate.title", { name: u.name }),
            body: t("confirm.reactivate.body"),
            confirmLabel: t("admin.reactivate"),
            tone: "primary",
            Icon: UserCheck,
        })
        if (!ok) return
        try {
            setBusyId(u.id)
            setError(null)
            await apiPatch(`/admin/users/${u.id}/reactivate`)
            setNotice(t("admin.reactivatedMsg", { name: u.name }))
            setReloadKey((k) => k + 1)
        } catch (e) {
            setError(e.code ? e : { key: "admin.couldNotAct" })
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
                    className={`${inputClass()} sm:max-w-xs`}
                />
                <div className="flex flex-wrap gap-2">
                    {USER_FILTERS.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => { setShow(value); setPage(0) }}
                            aria-pressed={show === value}
                            className={`h-8 rounded-md border px-3 text-sm font-medium ${
                                show === value
                                    ? "border-transparent bg-primary-soft text-link"
                                    : "border-border bg-surface text-muted hover:bg-surface-2 hover:text-ink"
                            }`}
                        >
                            {t(`admin.filter.${value}`)}
                        </button>
                    ))}
                </div>
            </div>

            <Message error={error} notice={notice} />

            <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface">
                <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="whitespace-nowrap border-b border-border bg-surface-2 text-xs text-muted">
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
                    <tbody className="divide-y divide-border">
                        {data?.users.map((u) => (
                            <tr key={u.id} className={loading ? "opacity-50" : ""}>
                                <td className="min-w-[13rem] px-4 py-3">
                                    <p className="font-medium text-ink">{u.name}</p>
                                    <p className="break-words text-xs text-muted">{u.email}</p>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                    <TierBadge tier={u.tier} />
                                    <p className="mt-1 text-xs tabular-nums text-muted">{t("admin.pts", { points: u.points })}</p>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-ink">
                                    {t("admin.problemCount", { count: u.problem_count })}
                                    <br />
                                    {t("common.solutions", { count: u.solution_count })}
                                </td>
                                <td className={`px-4 py-3 tabular-nums ${u.removal_count > 0 ? "font-semibold text-error" : "text-muted"}`}>
                                    {u.removal_count}
                                </td>
                                <td className="min-w-[8rem] px-4 py-3">
                                    <UserStatus u={u} />
                                    {u.is_suspended && u.suspension_reason && (
                                        <p className="mt-1 text-xs text-muted">{u.suspension_reason}</p>
                                    )}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                                    {formatDate(u.created_at)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right">
                                    {u.is_deleted ? null : !u.is_active ? (
                                        <button
                                            type="button"
                                            disabled={busyId === u.id}
                                            onClick={() => reactivate(u)}
                                            className={`${btnSecondary} ${btnSmall}`}
                                        >
                                            {t("admin.reactivate")}
                                        </button>
                                    ) : u.role !== "admin" && (
                                        u.is_suspended ? (
                                            <button
                                                type="button"
                                                disabled={busyId === u.id}
                                                onClick={() => changeSuspension(u, false)}
                                                className={`${btnSecondary} ${btnSmall}`}
                                            >
                                                {t("admin.unsuspend")}
                                            </button>
                                        ) : u.is_verified && (
                                            <button
                                                type="button"
                                                disabled={busyId === u.id}
                                                onClick={() => changeSuspension(u, true)}
                                                className={`${btnDanger} ${btnSmall}`}
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
                    <p className="p-6 text-center text-sm text-muted">{t("admin.noUsers")}</p>
                )}
                {loading && !data && (
                    <p className="p-6 text-center text-sm text-muted">{t("admin.loadingUsers")}</p>
                )}
            </div>

            <div className="mt-3 flex items-center justify-between text-sm text-muted">
                <span>{total > 0 ? t("admin.showing", { from, to, total }) : ""}</span>
                <div className="flex gap-2">
                    <button
                        type="button"
                        disabled={page === 0 || loading}
                        onClick={() => setPage((p) => p - 1)}
                        className={`${btnSecondary} ${btnSmall}`}
                    >
                        {t("admin.previous")}
                    </button>
                    <button
                        type="button"
                        disabled={to >= total || loading}
                        onClick={() => setPage((p) => p + 1)}
                        className={`${btnSecondary} ${btnSmall}`}
                    >
                        {t("admin.next")}
                    </button>
                </div>
            </div>
        </>
    )
}

const LOG_FILTERS = ["", "removed", "removed_no_penalty", "restored", "suspended", "unsuspended"]

// The picked days become exact times in the admin's own timezone; "To" includes the whole day.
function addDateRange(params, from, to) {
    if (from) params.set("since", new Date(`${from}T00:00`).toISOString())
    if (to) {
        const end = new Date(`${to}T00:00`)
        end.setDate(end.getDate() + 1)
        params.set("until", end.toISOString())
    }
}

function DateRange({ from, to, onFrom, onTo }) {
    const { t } = useLanguage()
    const field = `${inputClass()} mt-1 block w-auto`
    return (
        <>
            <label className="text-xs font-medium text-muted">
                {t("admin.dateFrom")}
                <input type="date" value={from} max={to || undefined} onChange={(e) => onFrom(e.target.value)} className={field} />
            </label>
            <label className="text-xs font-medium text-muted">
                {t("admin.dateTo")}
                <input type="date" value={to} min={from || undefined} onChange={(e) => onTo(e.target.value)} className={field} />
            </label>
            {(from || to) && (
                <button type="button" onClick={() => { onFrom(""); onTo("") }} className={`${btnSecondary} ${btnSmall} mb-1`}>
                    {t("admin.clearDates")}
                </button>
            )}
        </>
    )
}

const ACTION_TONES = {
    removed: "red",
    removed_no_penalty: "slate",
    restored: "green",
    suspended: "amber",
    unsuspended: "sky",
}

function ActivityTab() {
    const { t, label, formatDateTime } = useLanguage()
    const confirm = useConfirm()
    const [action, setAction] = useState("")
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [notice, setNotice] = useState("")
    const [busyId, setBusyId] = useState(null)
    const [reloadKey, setReloadKey] = useState(0)
    const [from, setFrom] = useState("")
    const [to, setTo] = useState("")

    useEffect(() => {
        let cancelled = false
        const timer = setTimeout(() => {
            setLoading(true)
            const params = new URLSearchParams({ limit: 200 })
            if (action) params.set("action", action)
            addDateRange(params, from, to)
            apiGet(`/admin/logs?${params}`)
                .then((d) => { if (!cancelled) { setLogs(d); setError(null) } })
                .catch((e) => { if (!cancelled) setError(e.code ? e : { key: "admin.couldNotLoadLog" }) })
                .finally(() => { if (!cancelled) setLoading(false) })
        }, 0)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [action, reloadKey, from, to])

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
        const ok = await confirm({
            title: t("confirm.restore.title"),
            body: t("confirm.restore.body"),
            preview: log.content_snapshot,
            confirmLabel: t("admin.restore"),
            tone: "primary",
            Icon: RotateCcw,
            reason: { label: t("confirm.reasonLabel") },
        })
        if (!ok) return
        const reason = ok.reason

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
            <div className="mt-6 flex flex-wrap items-end gap-3">
                <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    aria-label={t("admin.action.all")}
                    className={`${inputClass()} w-auto`}
                >
                    {LOG_FILTERS.map((value) => (
                        <option key={value} value={value}>{t(`admin.action.${value || "all"}`)}</option>
                    ))}
                </select>
                <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
            </div>

            <Message error={error} notice={notice} />

            {!loading && logs.length === 0 && (
                <p className="mt-4 rounded-lg border border-border bg-surface p-6 text-sm text-muted">
                    {t("admin.noActivity")}
                </p>
            )}

            <div className={`mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface ${loading ? "opacity-50" : ""} ${logs.length === 0 ? "hidden" : ""}`}>
                {logs.map((log) => (
                    <div key={log.id} className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={ACTION_TONES[log.action] || "slate"}>{label("admin.action", log.action)}</Badge>
                            <span className="text-sm text-ink">{describe(log)}</span>
                            <span className="ml-auto text-xs text-muted">{formatDateTime(log.created_at)}</span>
                        </div>

                        {log.reason && (
                            <p className="mt-2 text-sm text-muted">
                                <span className="font-medium text-ink">{t("admin.reason")}</span> {log.reason}
                            </p>
                        )}

                        {log.content_snapshot && (
                            <details className="mt-2 text-sm">
                                <summary className="cursor-pointer text-muted hover:text-ink">
                                    {t("admin.showContent")}
                                </summary>
                                <p className="mt-2 whitespace-pre-wrap rounded-md bg-surface-2 p-3 text-ink">
                                    {log.content_snapshot}
                                </p>
                            </details>
                        )}

                        {(log.action === "removed" || log.action === "removed_no_penalty") && log.target_status === "removed" && (
                            <button
                                type="button"
                                disabled={busyId === log.id}
                                onClick={() => restore(log)}
                                className={`${btnSecondary} ${btnSmall} mt-3`}
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
    "password_reset", "profile_updated", "account_deactivated", "account_reactivated", "account_deleted",
    "logout_all",
]

const AUDIT_TONES = {
    login_failed: "red",
    account_deactivated: "amber",
    account_reactivated: "green",
    account_deleted: "red",
    register: "green",
    email_verified: "green",
    password_reset: "sky",
    profile_updated: "sky",
    logout_all: "amber",
}

function AccountsTab() {
    const { t, formatDateTime } = useLanguage()
    const [action, setAction] = useState("")
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [from, setFrom] = useState("")
    const [to, setTo] = useState("")

    useEffect(() => {
        let cancelled = false
        const timer = setTimeout(() => {
            setLoading(true)
            const params = new URLSearchParams({ limit: 200 })
            if (action) params.set("action", action)
            addDateRange(params, from, to)
            apiGet(`/admin/audit?${params}`)
                .then((d) => { if (!cancelled) { setLogs(d); setError(null) } })
                .catch((e) => { if (!cancelled) setError(e.code ? e : { key: "admin.couldNotLoadAudit" }) })
                .finally(() => { if (!cancelled) setLoading(false) })
        }, 0)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [action, from, to])

    return (
        <>
            <div className="mt-6 flex flex-wrap items-end gap-3">
                <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    aria-label={t("admin.audit.all")}
                    className={`${inputClass()} w-auto`}
                >
                    <option value="">{t("admin.audit.all")}</option>
                    {AUDIT_ACTIONS.map((value) => <option key={value} value={value}>{t(`admin.audit.${value}`)}</option>)}
                </select>
                <DateRange from={from} to={to} onFrom={setFrom} onTo={setTo} />
            </div>

            <Message error={error} />

            {!loading && logs.length === 0 && (
                <p className="mt-4 rounded-lg border border-border bg-surface p-6 text-sm text-muted">
                    {t("admin.audit.empty")}
                </p>
            )}

            <div className={`mt-4 divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface ${loading ? "opacity-50" : ""} ${logs.length === 0 ? "hidden" : ""}`}>
                {logs.map((log) => (
                    <div key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                        <Badge tone={AUDIT_TONES[log.action] || "slate"}>{t(`admin.audit.${log.action}`)}</Badge>
                        <span className="text-ink">{log.user_name || log.email || t("admin.audit.unknown")}</span>
                        {log.user_name && log.email && <span className="break-all text-xs text-muted">{log.email}</span>}
                        <span className="ml-auto flex gap-3 text-xs text-muted">
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
        <Layout wide>
            <BackLink />
            <h1 className={`${pageTitle} mt-2`}>{t("admin.title")}</h1>
            <p className={pageSub}>{t("admin.subtitle")}</p>

            <div role="tablist" className="no-scrollbar mt-6 flex gap-6 overflow-x-auto border-b border-border">
                {TABS.map((value) => (
                    <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={tab === value}
                        onClick={() => setParams(value === "overview" ? {} : { tab: value })}
                        className={`relative h-11 whitespace-nowrap text-sm font-medium ${
                            tab === value
                                ? "text-ink after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary"
                                : "text-muted hover:text-ink"
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
