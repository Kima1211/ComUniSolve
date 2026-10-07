import { useEffect, useMemo, useState } from "react"
import { Link, useLocation, useSearchParams } from "react-router-dom"
import { Check, MessageSquare, Star, X } from "lucide-react"
import { apiGet, imageUrl } from "../api"
import { useLanguage } from "../i18n/language-context"
import { SECTORS } from "../categories"
import Avatar from "./Avatar"
import SearchBox from "./SearchBox"
import { searchProblems } from "../search"
import { timeAgo } from "../time"
import { alertError } from "../ui"
import { authorLabel } from "../author"

function sectorFor(category) {
    for (const s of SECTORS) if (s.categories.includes(category)) return s.name
    return "Other"
}

export function StatusChip({ status, t }) {
    const solved = status === "resolved"
    return (
        <span className={`status-ticket ${solved ? "status-ticket--solved" : ""}`}>
            <span className="status-ticket__body">
                {solved && <Check className="status-ticket__icon" strokeWidth={3} aria-hidden="true" />}
                {t(solved ? "status.solved" : "status.open")}
            </span>
        </span>
    )
}

export function ProblemCard({ problem }) {
    const { t, label } = useLanguage()
    const authorName = authorLabel(problem.author, t)
    const categoryLabel = label("category", problem.category)

    return (
        <article className="group block transition-colors hover:bg-surface-2 hover:rounded-md -mx-2 px-2 py-4">
            {/* Wraps instead of cutting words off: on narrow screens "by … · time" moves to a second line. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
                <span className="flex min-w-0 items-center gap-2">
                    <Avatar name={authorName} person={problem.author} size="xs" />
                    <span className="truncate font-medium text-ink">{categoryLabel}</span>
                </span>
                <span className="flex min-w-0 items-center gap-1.5 text-muted">
                    <span className="truncate">{t("post.by", { name: authorName })}</span>
                    <span>·</span>
                    <span className="whitespace-nowrap">{timeAgo(problem.created_at, t)}</span>
                </span>
            </div>

            <Link to={`/problems/${problem.id}`} className="mt-1.5 block">
                <h3 className="text-[17px] font-semibold leading-tight text-ink group-hover:underline-offset-2">
                    {problem.title}
                    <span className="ml-2 align-middle">
                        <StatusChip status={problem.status} t={t} />
                    </span>
                    {problem.accepted_rating && (
                        <span
                            role="img"
                            aria-label={t("common.stars", { count: problem.accepted_rating })}
                            title={t("common.stars", { count: problem.accepted_rating })}
                            className="ml-1.5 inline-flex items-center gap-1 align-middle text-[12px] font-medium text-muted"
                        >
                            <Star size={13} strokeWidth={1.75} aria-hidden="true" className="fill-gold text-on-gold" />
                            {t("common.outOfFive", { count: problem.accepted_rating })}
                        </span>
                    )}
                </h3>
            </Link>

            {problem.image_url ? (
                <Link to={`/problems/${problem.id}`} className="mt-3 block">
                    <img
                        src={imageUrl(problem.image_url, 800)}
                        alt=""
                        loading="lazy"
                        className="aspect-[16/9] max-h-[420px] w-full rounded-md border border-border object-cover"
                    />
                </Link>
            ) : (
                problem.description && (
                    <Link to={`/problems/${problem.id}`} className="mt-2 block">
                        <p className="line-clamp-3 text-sm leading-relaxed text-muted">{problem.description}</p>
                    </Link>
                )
            )}

            <div className="mt-3">
                <Link
                    to={`/problems/${problem.id}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md -ml-2 px-2 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-ink"
                >
                    <MessageSquare size={16} strokeWidth={1.75} aria-hidden="true" />
                    {t("common.solutions", { count: problem.solution_count ?? 0 })}
                </Link>
            </div>
        </article>
    )
}

function Skeleton() {
    return (
        <div className="divide-y divide-border">
            {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2 py-4 -mx-2 px-2">
                    <div className="h-3 w-48 animate-pulse rounded bg-surface-2" />
                    <div className="h-4 w-3/4 animate-pulse rounded bg-surface-2" />
                    <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
                    <div className="h-3 w-5/6 animate-pulse rounded bg-surface-2" />
                </div>
            ))}
        </div>
    )
}

function SortTabs({ value, onChange, t }) {
    const items = [
        { key: "newest", label: t("sort.newest") },
        { key: "unresolved", label: t("sort.needsHelp") },
        { key: "solved", label: t("sort.solved") },
    ]
    return (
        <div className="-mb-px flex gap-6 border-b border-border">
            {items.map((it) => {
                const active = value === it.key
                return (
                    <button
                        key={it.key}
                        type="button"
                        onClick={() => onChange(it.key)}
                        aria-pressed={active}
                        className={`relative h-11 text-sm font-medium ${
                            active ? "text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-primary" : "text-muted hover:text-ink"
                        }`}
                    >
                        {it.label}
                    </button>
                )
            })}
        </div>
    )
}

function ProblemFeed() {
    const { t, errorText } = useLanguage()
    const [params, setParams] = useSearchParams()
    const [error, setError] = useState(null)
    const [problems, setProblems] = useState([])
    const [loading, setLoading] = useState(true)
    const location = useLocation()
    const refresh = location.state?.refresh
    const [seenRefresh, setSeenRefresh] = useState(refresh)
    if (refresh !== seenRefresh) {
        setSeenRefresh(refresh)
        setLoading(true)
        setError(null)
    }

    const sort = params.get("sort") || "newest"
    const sector = params.get("sector") || ""
    const q = (params.get("q") || "").trim()

    useEffect(() => {
        let cancelled = false
        if (refresh) window.scrollTo({ top: 0, behavior: "smooth" })
        apiGet("/problems")
            .then((data) => { if (!cancelled) setProblems(data) })
            .catch((e) => { if (!cancelled) setError(e) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [refresh])

    const { results: shown, closest } = useMemo(() => {
        let xs = problems
        if (sort === "solved") xs = xs.filter((p) => p.status === "resolved")
        else if (sort === "unresolved") xs = xs.filter((p) => p.status !== "resolved")
        if (sector) xs = xs.filter((p) => sectorFor(p.category) === sector)
        return searchProblems(xs, q)
    }, [problems, sort, sector, q])

    function setSort(next) {
        const n = new URLSearchParams(params)
        if (next === "newest") n.delete("sort"); else n.set("sort", next)
        setParams(n, { replace: true, state: location.state })
    }

    function clearSearch() {
        const n = new URLSearchParams(params)
        n.delete("q")
        setParams(n, { replace: true, state: location.state })
    }

    return (
        <section>
            <SearchBox className="mb-3 md:hidden" />

            <SortTabs value={sort} onChange={setSort} t={t} />

            {q && (
                <div className="mt-3">
                    <button
                        type="button"
                        onClick={clearSearch}
                        aria-label={t("search.clear")}
                        className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-md bg-primary-soft px-3 text-[13px] font-medium text-link hover:bg-surface-2"
                    >
                        <span className="truncate">{t("search.active", { q })}</span>
                        <X size={14} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                    </button>
                </div>
            )}

            {loading && <Skeleton />}

            {error && (
                <div role="alert" className={`${alertError} mt-4 py-2.5`}>
                    {errorText(error)}
                </div>
            )}

            {!loading && !error && shown.length === 0 && !q && (
                <div className="py-16 text-center">
                    <p className="text-sm text-muted">{t("feed.empty")}</p>
                </div>
            )}

            {!loading && !error && q && shown.length === 0 && closest.length > 0 && (
                <>
                    <p className="pt-4 pb-1 text-sm text-muted">{t("search.noExact", { q })}</p>
                    <div className="divide-y divide-border">
                        {closest.map((problem) => (
                            <ProblemCard key={problem.id} problem={problem} />
                        ))}
                    </div>
                </>
            )}

            {!loading && !error && q && shown.length === 0 && (
                <div className={`text-center ${closest.length > 0 ? "border-t border-border py-8" : "py-16"}`}>
                    <p className="text-sm text-muted">
                        {closest.length > 0 ? t("search.didntFind") : t("search.noResults", { q })}
                    </p>
                    <Link
                        to={`/postproblem?title=${encodeURIComponent(q.slice(0, 255))}`}
                        className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover shine"
                    >
                        {t("search.postThis")}
                    </Link>
                </div>
            )}

            <div className="divide-y divide-border">
                {shown.map((problem) => (
                    <ProblemCard key={problem.id} problem={problem} />
                ))}
            </div>
        </section>
    )
}

export default ProblemFeed
