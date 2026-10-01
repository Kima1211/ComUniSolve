import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { apiGet, imageUrl } from "../api"
import { useLanguage } from "../i18n/language-context"

export function ProblemCard({ problem }) {
    const { t, label } = useLanguage()
    return (
        <Link
            to={`/problems/${problem.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:shadow-sm"
        >
            <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-slate-900">{problem.title}</h3>
                <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        problem.status === "resolved"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                    }`}
                >
                    {problem.status === "resolved" ? t("common.resolved") : t("common.open")}
                </span>
            </div>

            {problem.description && (
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">{problem.description}</p>
            )}

            {problem.image_url && (
                <img
                    src={imageUrl(problem.image_url, 600)}
                    alt=""
                    loading="lazy"
                    className="mt-3 h-40 w-full rounded-lg bg-slate-100 object-cover"
                />
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    {label("category", problem.category)}
                </span>
                {problem.author && <span>{t("common.by", { name: problem.author.name })}</span>}
                <span>{t("common.solutions", { count: problem.solution_count })}</span>
            </div>
        </Link>
    )
}

function ProblemFeed() {
    const { t, errorText } = useLanguage()
    const [error, setError] = useState(null)
    const [problems, setProblems] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        apiGet("/problems")
            .then((data) => { if (!cancelled) setProblems(data) })
            .catch((e) => { if (!cancelled) setError(e) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [])

    if (loading) {
        return (
            <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
                ))}
            </div>
        )
    }

    return (
        <div>
            <h1 className="text-xl font-bold text-slate-900">{t("feed.title")}</h1>
            <p className="mt-1 text-sm text-slate-500">{t("feed.newest")}</p>

            {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {errorText(error)}
                </div>
            )}

            {!error && problems.length === 0 && (
                <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    {t("feed.empty")}
                </p>
            )}

            <div className="mt-5 space-y-3">
                {problems.map((problem) => (
                    <ProblemCard key={problem.id} problem={problem} />
                ))}
            </div>
        </div>
    )
}

export default ProblemFeed
