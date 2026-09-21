import { useState } from "react";
import { apiGet, apiPost, apiPatch } from "../api";
import { TierBadge } from "./Layout";
import ReportButton from "./ReportButton";

/**
 * One solution: its author, the text, and every action the backend allows -
 * accept/unaccept (problem owner), upvote (anyone signed in), rate (problem
 * owner) and comments (anyone signed in).
 *
 * onChanged() tells the parent page to refetch, so counts and statuses stay
 * truthful instead of being guessed at locally.
 */
function SolutionCard({ solution, problem, currentUser, onChanged }) {
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)

    const [comments, setComments] = useState(null)   // null = not loaded yet
    const [commentText, setCommentText] = useState("")
    const [ratingOpen, setRatingOpen] = useState(false)

    const isAccepted = solution.status === "accepted"
    const isProblemOwner = currentUser && currentUser.id === problem.user_id
    const signedIn = Boolean(currentUser)

    async function run(action) {
        try {
            setError("")
            setBusy(true)
            await action()
            onChanged()
        } catch (e) {
            setError(e.message || "Something went wrong")
        } finally {
            setBusy(false)
        }
    }

    async function toggleComments() {
        if (comments !== null) {
            setComments(null)
            return
        }
        try {
            setComments(await apiGet(`/solutions/${solution.id}/comments`))
        } catch (e) {
            setError(e.message || "Could not load comments")
        }
    }

    async function submitComment(e) {
        e.preventDefault()
        if (!commentText.trim()) return
        try {
            setBusy(true)
            await apiPost(`/comment/${solution.id}`, { content: commentText, parent_id: null })
            setCommentText("")
            setComments(await apiGet(`/solutions/${solution.id}/comments`))
        } catch (e) {
            setError(e.message || "Could not post comment")
        } finally {
            setBusy(false)
        }
    }

    return (
        <div
            className={`rounded-xl border bg-white p-5 ${
                isAccepted ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"
            }`}
        >
            {isAccepted && (
                <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    Accepted solution
                </p>
            )}

            <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                    {solution.author ? solution.author.name : "Unknown"}
                </span>
                {solution.author && <TierBadge tier={solution.author.tier} />}
            </div>

            <p className="mt-3 whitespace-pre-wrap text-slate-700">{solution.solution_text}</p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    disabled={!signedIn || busy}
                    onClick={() => run(() => apiPost(`/solutions/${solution.id}/upvote`))}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700
                               hover:border-brand-400 hover:text-brand-700 disabled:opacity-40"
                    title={signedIn ? "Upvote this solution" : "Sign in to upvote"}
                >
                    ▲ {solution.upvote_count}
                </button>

                {isProblemOwner && (
                    isAccepted ? (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => run(() => apiPatch(`/solutions/${solution.id}/unaccept`))}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                        >
                            Un-accept
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => run(() => apiPatch(`/solutions/${solution.id}/accept`))}
                            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
                        >
                            Accept
                        </button>
                    )
                )}

                {isProblemOwner && (
                    <button
                        type="button"
                        onClick={() => setRatingOpen((v) => !v)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        Rate
                    </button>
                )}

                <button
                    type="button"
                    onClick={toggleComments}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
                >
                    {comments === null ? "Comments" : "Hide comments"}
                </button>

                {signedIn && currentUser?.id !== solution.user_id && (
                    <div className="ml-auto">
                        <ReportButton solutionId={solution.id} />
                    </div>
                )}
            </div>

            {ratingOpen && isProblemOwner && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 p-3">
                    <span className="text-sm text-slate-600">Your rating:</span>
                    {[1, 2, 3, 4, 5].map((score) => (
                        <button
                            key={score}
                            type="button"
                            disabled={busy}
                            onClick={() =>
                                run(async () => {
                                    await apiPost(`/solutions/${solution.id}/rate`, { score, feedback: null })
                                    setRatingOpen(false)
                                })
                            }
                            className="h-8 w-8 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:border-amber-400 hover:text-amber-600 disabled:opacity-40"
                        >
                            {score}
                        </button>
                    ))}
                </div>
            )}

            {error && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                </p>
            )}

            {comments !== null && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                    {comments.length === 0 && (
                        <p className="text-sm text-slate-500">No comments yet.</p>
                    )}
                    <div className="space-y-3">
                        {comments.map((c) => (
                            <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2">
                                <p className="text-xs font-semibold text-slate-700">
                                    {c.author ? c.author.name : "Unknown"}
                                </p>
                                <p className="text-sm text-slate-700">{c.content}</p>
                            </div>
                        ))}
                    </div>

                    {signedIn && (
                        <form onSubmit={submitComment} className="mt-3 flex gap-2">
                            <input
                                type="text"
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                placeholder="Add a comment"
                                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                            />
                            <button
                                type="submit"
                                disabled={busy}
                                className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-40"
                            >
                                Send
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    )
}

export default SolutionCard
