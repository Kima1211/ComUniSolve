import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Bell, Check, MessageCircle, MessageSquareText, Sparkles, Trash2 } from "lucide-react"
import { apiDelete, apiGet, apiPost } from "../api"
import { useConfirm } from "../confirm-context"
import { useLanguage } from "../i18n/language-context"
import { timeAgo } from "../time"

const POLL_MS = 60_000
const ICONS = {
    new_solution: MessageSquareText, new_comment: MessageCircle, solution_accepted: Check,
    tier_contributor: Sparkles, tier_trusted: Sparkles, tier_expert: Sparkles,
}

function NotificationBell() {
    const { t } = useLanguage()
    const navigate = useNavigate()
    const confirm = useConfirm()
    const [open, setOpen] = useState(false)
    const [data, setData] = useState({ unread: 0, items: [] })
    const boxRef = useRef(null)

    const load = useCallback(() => {
        apiGet("/notifications").then(setData).catch(() => {})
    }, [])

    // Checks again every minute while the tab is visible, and when the user comes back to it.
    useEffect(() => {
        load()
        const timer = setInterval(() => { if (!document.hidden) load() }, POLL_MS)
        window.addEventListener("focus", load)
        return () => { clearInterval(timer); window.removeEventListener("focus", load) }
    }, [load])

    useEffect(() => {
        if (!open) return
        const close = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
        const onKey = (e) => { if (e.key === "Escape") setOpen(false) }
        document.addEventListener("mousedown", close)
        document.addEventListener("keydown", onKey)
        return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", onKey) }
    }, [open])

    function toggle() {
        if (!open) load()
        setOpen(!open)
    }

    function openItem(n) {
        setOpen(false)
        if (!n.read) {
            setData((d) => ({ unread: Math.max(0, d.unread - 1), items: d.items.map((x) => x.id === n.id ? { ...x, read: true } : x) }))
            apiPost(`/notifications/${n.id}/read`).catch(() => {})
        }
        // Title notifications point to where the new frame can be chosen.
        navigate(n.problem_id ? `/problems/${n.problem_id}` : "/profile/edit")
    }

    function markAll() {
        setData((d) => ({ unread: 0, items: d.items.map((x) => ({ ...x, read: true })) }))
        apiPost("/notifications/read-all").catch(() => {})
    }

    async function clearAll() {
        setOpen(false)
        const ok = await confirm({
            title: t("notif.clearTitle"),
            body: t("notif.clearBody"),
            confirmLabel: t("notif.clearAll"),
            Icon: Trash2,
        })
        if (!ok) return
        setData({ unread: 0, items: [] })
        apiDelete("/notifications").catch(() => load())
    }

    const badge = data.unread > 9 ? "9+" : String(data.unread)
    const label = data.unread
        ? `${t("notif.title")} (${t("notif.unread", { n: data.unread })})`
        : t("notif.title")

    return (
        <div ref={boxRef} className="relative">
            <button
                type="button"
                onClick={toggle}
                aria-label={label}
                aria-expanded={open}
                aria-haspopup="true"
                className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border text-muted hover:bg-surface-2 hover:text-ink sm:h-8 sm:w-8"
            >
                <Bell size={16} strokeWidth={1.75} aria-hidden="true" />
                {data.unread > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-[18px] text-on-primary">
                        {badge}
                    </span>
                )}
            </button>

            {open && (
                <div className="fixed inset-x-2 top-16 z-40 overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-float)]
                                sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[360px]">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <p className="text-sm font-semibold text-ink">{t("notif.title")}</p>
                        <div className="flex items-center gap-3">
                            {data.unread > 0 && (
                                <button type="button" onClick={markAll} className="text-xs font-medium text-link hover:underline">
                                    {t("notif.markAll")}
                                </button>
                            )}
                            {data.items.length > 0 && (
                                <button type="button" onClick={clearAll} className="text-xs font-medium text-muted hover:text-error hover:underline">
                                    {t("notif.clearAll")}
                                </button>
                            )}
                        </div>
                    </div>

                    {data.items.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-muted">{t("notif.empty")}</p>
                    ) : (
                        <ul className="max-h-[60vh] overflow-y-auto">
                            {data.items.map((n) => {
                                const Icon = ICONS[n.type] || Bell
                                const name = n.actor_deleted ? t("common.deletedUser") : n.actor_name
                                return (
                                    <li key={n.id}>
                                        <button
                                            type="button"
                                            onClick={() => openItem(n)}
                                            className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2 ${n.read ? "" : "bg-primary-soft/50"}`}
                                        >
                                            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-link">
                                                <Icon size={16} strokeWidth={2} aria-hidden="true" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm text-ink">
                                                    {t(`notif.${n.type}`, { name })}
                                                </span>
                                                <span className="block truncate text-sm font-medium text-ink">{n.problem_title ?? t("notif.tierHint")}</span>
                                                <span className="block text-xs text-muted">{timeAgo(n.created_at, t)}</span>
                                            </span>
                                            {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label={t("notif.new")} />}
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}

export default NotificationBell
