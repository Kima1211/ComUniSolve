import { useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPost, apiPatch } from "../api";
import { TierBadge } from "./Layout";
import ReportButton from "./ReportButton";
import ModerationNotice from "./ModerationNotice";
import Stars from "./Stars";

function CommentItem({ comment, currentUser, onChanged }) {
    const [editing, setEditing] = useState(false)
    const [text, setText] = useState(comment.content)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")

    const isAuthor = currentUser && currentUser.id === comment.user_id

    async function run(action) {
        try {
            setError("")
            setBusy(true)
            await action()
            await onChanged()
        } catch (e) {
            setError(e.message || "Something went wrong")
        } finally {
            setBusy(false)
        }
    }

    function save(e) {
        e.preventDefault()
        if (!text.trim()) return
        run(async () => {
            await apiPatch(`/comments/${comment.id}`, { content: text })
            setEditing(false)
        })
    }

    function remove() {
        if (!window.confirm("Delete this comment?")) return
        run(() => apiDelete(`/comments/${comment.id}`))
    }

    return (
        <div className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-700">
                    {comment.author ? (
                        <Link to={`/users/${comment.author.id}`} className="hover:underline">{comment.author.name}</Link>
                    ) : "Unknown"}
                </p>
                {comment.edited_at && <span className="text-xs text-slate-400">edited</span>}
                {isAuthor && !editing && (
                    <div className="ml-auto flex gap-2 text-xs">
                        <button type="button" onClick={() => setEditing(true)} className="text-slate-500 hover:text-slate-900">
                            Edit
                        </button>
                        <button type="button" onClick={remove} disabled={busy} className="text-red-600 hover:text-red-800">
                            Delete
                        </button>
                    </div>
                )}
            </div>

            {editing ? (
                <form onSubmit={save} className="mt-1 flex gap-2">
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        maxLength={2000}
                        className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
                    />
                    <button type="submit" disabled={busy || !text.trim()} className="text-xs font-medium text-brand-700 disabled:opacity-40">
                        Save
                    </button>
                    <button
                        type="button"
                        onClick={() => { setEditing(false); setText(comment.content) }}
                        className="text-xs text-slate-500"
                    >
                        Cancel
                    </button>
                </form>
            ) : (
                <p className="text-sm text-slate-700">{comment.content}</p>
            )}

            {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
        </div>
    )
}

function SolutionCard({ solution, problem, currentUser, onChanged }) {
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)

    const [comments, setComments] = useState(null)
    const [commentText, setCommentText] = useState("")
    const [ratingOpen, setRatingOpen] = useState(false)

    const [editing, setEditing] = useState(false)
    const [editText, setEditText] = useState(solution.solution_text)
    const [editGate, setEditGate] = useState(null)

    const isAccepted = solution.status === "accepted"
    const isProblemOwner = currentUser && currentUser.id === problem.user_id
    const isAuthor = currentUser && currentUser.id === solution.user_id
    const signedIn = Boolean(currentUser)
    // Only the poster rates, only the accepted solution, and never their own.
    const canRate = isProblemOwner && isAccepted && !isAuthor

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

    async function saveEdit(acknowledged) {
        try {
            setError("")
            setEditGate(null)
            setBusy(true)
            await apiPatch(`/solutions/${solution.id}`, { solution_text: editText, acknowledged })
            setEditing(false)
            onChanged()
        } catch (e) {
            // Edits pass through the same moderation gate as new posts.
            if (e.status === 422 && e.detail?.verdict) {
                setEditGate(e.detail)
                return
            }
            setError(e.message || "Could not save your changes")
        } finally {
            setBusy(false)
        }
    }

    function cancelEdit() {
        setEditing(false)
        setEditText(solution.solution_text)
        setEditGate(null)
    }

    function deleteSolution() {
        if (!window.confirm("Delete this solution? The points it earned you will be taken back.")) return
        run(() => apiDelete(`/solutions/${solution.id}`))
    }

    async function reloadComments() {
        setComments(await apiGet(`/solutions/${solution.id}/comments`))
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
            await reloadComments()
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
                <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        Accepted solution
                    </p>
                    {solution.rating && (
                        <p className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Stars value={solution.rating} className="text-base" />
                            rated by the poster
                        </p>
                    )}
                </div>
            )}

            <div className="flex items-center gap-2">
                {solution.author ? (
                    <Link to={`/users/${solution.author.id}`} className="text-sm font-semibold text-slate-900 hover:underline">
                        {solution.author.name}
                    </Link>
                ) : (
                    <span className="text-sm font-semibold text-slate-900">Unknown</span>
                )}
                {solution.author && <TierBadge tier={solution.author.tier} />}
                {solution.edited_at && <span className="text-xs text-slate-400">edited</span>}
                {isAuthor && !editing && (
                    <div className="ml-auto flex gap-2">
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Edit
                        </button>
                        {!isAccepted && (
                            <button
                                type="button"
                                onClick={deleteSolution}
                                disabled={busy}
                                className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                                Delete
                            </button>
                        )}
                    </div>
                )}
            </div>

            {editing ? (
                <div className="mt-3">
                    <textarea
                        rows={4}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        maxLength={5000}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none
                                   focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                    />
                    {editGate && (
                        <div className="mt-2">
                            <ModerationNotice
                                gate={editGate}
                                busy={busy}
                                onUseSuggestion={(s) => { setEditText(s); setEditGate(null) }}
                                onPostAnyway={() => saveEdit(true)}
                            />
                        </div>
                    )}
                    <div className="mt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={() => saveEdit(false)}
                            disabled={busy || !editText.trim()}
                            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300"
                        >
                            {busy ? "Saving..." : "Save changes"}
                        </button>
                        <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={busy}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <p className="mt-3 whitespace-pre-wrap text-slate-700">{solution.solution_text}</p>
            )}

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
                            onClick={() =>
                                run(async () => {
                                    await apiPatch(`/solutions/${solution.id}/accept`)
                                    // Nudge, not force: ask for stars right away, but rating stays optional.
                                    if (!isAuthor) setRatingOpen(true)
                                })
                            }
                            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40"
                        >
                            Accept
                        </button>
                    )
                )}

                {canRate && (
                    <button
                        type="button"
                        onClick={() => setRatingOpen((v) => !v)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        {solution.rating ? "Change rating" : "Rate"}
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

            {ratingOpen && canRate && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <span className="text-sm text-amber-900">How well did this work? (optional)</span>
                    <div className="flex">
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
                                title={`${score} out of 5 stars`}
                                className={`px-0.5 text-2xl leading-none hover:scale-110 disabled:opacity-40 ${
                                    score <= (solution.rating || 0) ? "text-amber-500" : "text-slate-300 hover:text-amber-400"
                                }`}
                            >
                                ★
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => setRatingOpen(false)}
                        className="ml-auto text-xs font-medium text-amber-900 underline underline-offset-2"
                    >
                        Later
                    </button>
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
                            <CommentItem key={c.id} comment={c} currentUser={currentUser} onChanged={reloadComments} />
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
