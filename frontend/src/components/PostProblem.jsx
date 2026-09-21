import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api";
import Layout from "./Layout";
import SimilarProblems from "./SimilarProblems";

const CATEGORIES = ["Household", "School", "Public", "Health", "Livelihood", "Other"]

const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 " +
    "outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"

function PostProblem() {
    const navigate = useNavigate()

    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState(CATEGORIES[0])
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [matches, setMatches] = useState([])
    const [aiUsed, setAiUsed] = useState(false)
    const [checkingAi, setCheckingAi] = useState(false)

    // Layer 2 is user-triggered, never automatic. One deliberate click costs
    // one API call; firing it while someone types would cost dozens.
    async function checkWithAI() {
        try {
            setCheckingAi(true)
            const data = await apiPost("/problems/match/ai", { title, description })
            setMatches(data.matches || [])
            setAiUsed(Boolean(data.ai_used))
        } catch {
            // The TF-IDF results already on screen stay - a failed second
            // opinion should never take away the first one.
        } finally {
            setCheckingAi(false)
        }
    }

    // Solution Matching, live. Debounced by 600ms: without it, every keystroke
    // would fire a request and the answers would arrive out of order.
    useEffect(() => {
        let cancelled = false
        const timer = setTimeout(() => {
            // Too short to say anything useful about - clear and stop.
            if (title.trim().length < 6) {
                if (!cancelled) setMatches([])
                return
            }
            apiPost("/problems/match", { title, description })
                .then((data) => {
                    if (cancelled) return
                    setMatches(data.matches || [])
                    setAiUsed(false)   // typing again invalidates the AI pass
                })
                .catch(() => { if (!cancelled) setMatches([]) })
        }, 600)

        return () => { cancelled = true; clearTimeout(timer) }
    }, [title, description])

    async function handleSubmit(e) {
        e.preventDefault()
        try {
            setError("")
            setSubmitting(true)
            const data = await apiPost("/problems", { title, description, category })
            navigate(`/problems/${data.id}`)
        } catch (e) {
            if (e.status === 401) { navigate('/login'); return }
            setError(e.message || "Something went wrong! Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Layout>
            <div className="mx-auto max-w-2xl">
                <h1 className="text-xl font-bold text-slate-900">Post a problem</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Describe it clearly — the more context, the better the answers.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                        <input
                            id="title" type="text" className={inputClass} disabled={submitting}
                            placeholder="Street light on Rizal St. has been out for weeks"
                            value={title} onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                        <textarea
                            id="description" rows={6} className={inputClass} disabled={submitting}
                            placeholder="What is happening, since when, and what have you already tried?"
                            value={description} onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                        <select
                            id="category" className={inputClass} disabled={submitting}
                            value={category} onChange={(e) => setCategory(e.target.value)}
                        >
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting || !title.trim()}
                        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white
                                   hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        {submitting ? "Posting..." : "Post problem"}
                    </button>
                </form>

                <div className="mt-6">
                    <SimilarProblems
                        matches={matches}
                        aiUsed={aiUsed}
                        hint="Someone may already have asked this. Check before posting — an answer might be waiting."
                    />

                    {aiUsed && matches.length === 0 && (
                        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                            The AI checked every existing problem and found none related to
                            yours. Go ahead and post it.
                        </p>
                    )}

                    {title.trim().length >= 6 && !aiUsed && (
                        <button
                            type="button"
                            onClick={checkWithAI}
                            disabled={checkingAi}
                            className="mt-3 w-full rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm
                                       font-medium text-purple-800 hover:bg-purple-100 disabled:opacity-50"
                        >
                            {checkingAi ? "Asking the AI..." : "Search again with AI (finds different wording)"}
                        </button>
                    )}
                </div>
            </div>
        </Layout>
    )
}

export default PostProblem
