import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { apiGet } from "../api"

export function ProblemCard({ problem }) {
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
                    {problem.status === "resolved" ? "Resolved" : "Open"}
                </span>
            </div>

            {problem.description && (
                <p className="mt-2 text-sm text-slate-600 line-clamp-2">{problem.description}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    {problem.category}
                </span>
                {problem.author && <span>by {problem.author.name}</span>}
                <span>
                    {problem.solution_count} {problem.solution_count === 1 ? "solution" : "solutions"}
                </span>
            </div>
        </Link>
    )
}

function ProblemFeed() {
    const [error, setError] = useState("")
    const [problems, setProblems] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false
        apiGet("/problems")
            .then((data) => { if (!cancelled) setProblems(data) })
            .catch((e) => { if (!cancelled) setError(e.message || "Something went wrong") })
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
            <h1 className="text-xl font-bold text-slate-900">Community problems</h1>
            <p className="mt-1 text-sm text-slate-500">Newest first.</p>

            {error && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}

            {!error && problems.length === 0 && (
                <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    No problems posted yet. Be the first.
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
