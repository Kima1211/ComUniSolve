import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { apiGet, apiPost, imageUrl } from "../api";
import { useAuth } from "../auth-context";
import Layout, { TierBadge } from "./Layout";
import SolutionCard from "./SolutionCard";
import SimilarProblems from "./SimilarProblems";
import ModerationNotice from "./ModerationNotice";
import ReportButton from "./ReportButton";

function ProblemDetail() {
    const { id } = useParams()
    const { user } = useAuth()
    // Set by PostProblem when the problem was posted but its photo failed.
    const imageError = useLocation().state?.imageError

    const [problem, setProblem] = useState(null)
    const [solutions, setSolutions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    const [text, setText] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState("")
    const [solutionGate, setSolutionGate] = useState(null)
    const [matches, setMatches] = useState([])
    const [matchesAiUsed, setMatchesAiUsed] = useState(false)
    const [checkingAi, setCheckingAi] = useState(false)
    const [aiFailed, setAiFailed] = useState(false)

    // StrictMode mounts twice in dev; without this the AI is asked twice.
    const aiAskedFor = useRef(null)

    const askAI = useCallback(async () => {
        try {
            setAiFailed(false)
            setCheckingAi(true)
            const data = await apiGet(`/problems/${id}/similar/ai`)
            setMatches(data.matches || [])
            setMatchesAiUsed(Boolean(data.ai_used))
            if (!data.ai_used) setAiFailed(true)
        } catch {
            setAiFailed(true)
        } finally {
            setCheckingAi(false)
        }
    }, [id])

    // Word overlap renders first so the page is never blank, then the AI
    // answer replaces it.
    useEffect(() => {
        let cancelled = false
        setMatches([])
        setMatchesAiUsed(false)
        setAiFailed(false)

        apiGet(`/problems/${id}/similar`)
            .then((data) => {
                if (cancelled) return
                setMatches(data.matches || [])
                setMatchesAiUsed(Boolean(data.ai_used))
                if (data.ai_used) return
                if (aiAskedFor.current === id) return
                aiAskedFor.current = id
                return askAI()
            })
            .catch(() => { if (!cancelled) setMatches([]) })
        return () => { cancelled = true }
    }, [id, askAI])

    // Promise.all so both requests run at the same time.
    const fetchAll = useCallback(
        () => Promise.all([apiGet(`/problems/${id}`), apiGet(`/solutions/problem/${id}`)]),
        [id]
    )

    // Refetch after any action, so the page shows what the server says.
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

    // Solutions go through the same moderation gate as problems.
    async function postSolution(acknowledged) {
        try {
            setSubmitError("")
            setSolutionGate(null)
            setSubmitting(true)
            await apiPost("/solutions", {
                problem_id: Number(id), solution_text: text, acknowledged,
            })
            setText("")
            await load()
        } catch (e) {
            if (e.status === 422 && e.detail?.verdict) {
                setSolutionGate(e.detail)
                return
            }
            setSubmitError(e.message || "Could not submit your solution")
        } finally {
            setSubmitting(false)
        }
    }

    function submitSolution(e) {
        e.preventDefault()
        postSolution(false)
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

            {imageError && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Your problem was posted, but the photo wasn't added: {imageError}
                </div>
            )}

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
                    {user && user.id !== problem.user_id && (
                        <div className="ml-auto">
                            <ReportButton problemId={problem.id} />
                        </div>
                    )}
                </div>

                {problem.description && (
                    <p className="mt-4 whitespace-pre-wrap text-slate-700">{problem.description}</p>
                )}

                {problem.image_url && (
                    // Links to the original so people can see full detail.
                    <a href={problem.image_url} target="_blank" rel="noreferrer" className="mt-4 block">
                        <img
                            src={imageUrl(problem.image_url, 1000)}
                            alt={`Photo for: ${problem.title}`}
                            className="max-h-[28rem] w-full rounded-lg border border-slate-200 bg-slate-50 object-contain"
                        />
                    </a>
                )}
            </article>

            <div className="mt-6">
                <SimilarProblems
                    matches={matches}
                    aiUsed={matchesAiUsed}
                    title="Related problems"
                    hint={
                        matchesAiUsed
                            ? "Word overlap gathered the candidates; the AI judged which describe the same issue, including across English and Tagalog."
                            : "Matched by comparing the wording of every problem on the platform."
                    }
                />

                {checkingAi && (
                    <p className="mt-3 flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50
                                  px-4 py-2 text-sm text-purple-800">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-purple-500" />
                        Checking with AI for problems worded differently...
                    </p>
                )}

                {!checkingAi && matchesAiUsed && matches.length === 0 && (
                    <p className="mt-3 rounded-lg border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
                        The AI read every other problem on the platform and found none describing this issue.
                    </p>
                )}

                {!checkingAi && aiFailed && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg
                                    border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                        <span>
                            {matches.length > 0
                                ? "The AI layer could not be reached, so these are word matches only."
                                : "The AI layer could not be reached, and word matching found nothing."}
                        </span>
                        <button
                            type="button"
                            onClick={askAI}
                            className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs
                                       font-medium text-amber-900 hover:bg-amber-100"
                        >
                            Try again
                        </button>
                    </div>
                )}
            </div>

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

                        {solutionGate && (
                            <div className="mt-2">
                                <ModerationNotice
                                    gate={solutionGate}
                                    busy={submitting}
                                    onUseSuggestion={(s) => { setText(s); setSolutionGate(null) }}
                                    onPostAnyway={() => postSolution(true)}
                                />
                            </div>
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
