import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiGet, apiPost } from "../api";
import { useAuth } from "../auth-context";
import Layout, { TierBadge } from "./Layout";
import SolutionCard from "./SolutionCard";
import SimilarProblems from "./SimilarProblems";

function ProblemDetail() {
    const { id } = useParams()
    const { user } = useAuth()

    const [problem, setProblem] = useState(null)
    const [solutions, setSolutions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    const [text, setText] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState("")
    const [matches, setMatches] = useState([])
    const [matchesAiUsed, setMatchesAiUsed] = useState(false)

    // Similar problems for this one. Separate from the main load because a
    // failure here must not stop the problem itself from rendering.
    useEffect(() => {
        let cancelled = false
        apiGet(`/problems/${id}/similar`)
            .then((data) => {
                if (cancelled) return
                setMatches(data.matches || [])
                setMatchesAiUsed(Boolean(data.ai_used))
            })
            .catch(() => { if (!cancelled) setMatches([]) })
        return () => { cancelled = true }
    }, [id])

    // Two endpoints, one load. Promise.all runs them at the same time rather
    // than waiting for the first to finish before starting the second.
    const fetchAll = useCallback(
        () => Promise.all([apiGet(`/problems/${id}`), apiGet(`/solutions/problem/${id}`)]),
        [id]
    )

    // Used after any action (accept, upvote, comment) so the page reflects
    // what the server actually says rather than a guess made locally.
    const load = useCallback(async () => {
        const [p, s] = await fetchAll()
        setProblem(p)
        setSolutions(s)
    }, [fetchAll])

    useEffect(() => {
        let cancelled = false
        fetchAll()
            .then(([p, s]) => { if (!cancelled) { setProblem(p); setSolutions(s) } })
            .catch((e) => { if (!cancelled) setError(e.message || "Could not load this problem") })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [fetchAll])

    async function submitSolution(e) {
        e.preventDefault()
        try {
            setSubmitError("")
            setSubmitting(true)
            await apiPost("/solutions", { problem_id: Number(id), solution_text: text })
            setText("")
            await load()
        } catch (e) {
            setSubmitError(e.message || "Could not submit your solution")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return <Layout><div className="h-40 animate-pulse rounded-xl bg-white" /></Layout>
    }

    if (error || !problem) {
        return (
            <Layout>
                <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error || "Problem not found."}
                </p>
                <Link to="/" className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline">
                    Back to the feed
                </Link>
            </Layout>
        )
    }

    return (
        <Layout>
            <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-900">
                ← Back to the feed
            </Link>

            <article className="mt-4 rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex items-start justify-between gap-3">
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">{problem.title}</h1>
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

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {problem.category}
                    </span>
                    {problem.author && (
                        <>
                            <span>posted by {problem.author.name}</span>
                            <TierBadge tier={problem.author.tier} />
                        </>
                    )}
                </div>

                {problem.description && (
                    <p className="mt-4 whitespace-pre-wrap text-slate-700">{problem.description}</p>
                )}
            </article>

            {matches.length > 0 && (
                <div className="mt-6">
                    <SimilarProblems
                        matches={matches}
                        aiUsed={matchesAiUsed}
                        title="Related problems"
                        hint="Matched by comparing the wording of every problem on the platform."
                    />
                </div>
            )}

            <section className="mt-8">
                <h2 className="text-lg font-semibold text-slate-900">
                    {solutions.length} {solutions.length === 1 ? "solution" : "solutions"}
                </h2>

                <div className="mt-4 space-y-3">
                    {solutions.length === 0 && (
                        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                            No solutions yet. If you know the answer, share it below.
                        </p>
                    )}
                    {solutions.map((s) => (
                        <SolutionCard
                            key={s.id}
                            solution={s}
                            problem={problem}
                            currentUser={user}
                            onChanged={load}
                        />
                    ))}
                </div>
            </section>

            <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
                <h2 className="text-lg font-semibold text-slate-900">Your solution</h2>

                {!user ? (
                    <p className="mt-3 text-sm text-slate-600">
                        <Link to="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>
                        {" "}to answer this problem.
                    </p>
                ) : !user.is_verified ? (
                    <p className="mt-3 text-sm text-amber-800">
                        Verify your email before posting a solution — check your inbox for the link.
                    </p>
                ) : (
                    <form onSubmit={submitSolution} className="mt-3">
                        <textarea
                            rows={4}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Explain how to solve this, step by step."
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none
                                       focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                        />
                        {submitError && (
                            <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {submitError}
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={submitting || !text.trim()}
                            className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white
                                       hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            {submitting ? "Posting..." : "Post solution"}
                        </button>
                    </form>
                )}
            </section>
        </Layout>
    )
}

export default ProblemDetail
