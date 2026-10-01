import { useState } from "react";
import { Link } from "react-router-dom";
import { apiDelete, apiGet, apiPost, apiPatch } from "../api";
import { useLanguage } from "../i18n/language-context";
import { TierBadge } from "./Layout";
import ReportButton from "./ReportButton";
import ModerationNotice from "./ModerationNotice";
import Stars from "./Stars";
import AiCheckStatus from "./AiCheckStatus";

function CommentItem({ comment, currentUser, onChanged }) {
    const { t, errorText } = useLanguage()
    const [editing, setEditing] = useState(false)
    const [text, setText] = useState(comment.content)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)

    const isAuthor = currentUser && currentUser.id === comment.user_id

    async function run(action) {
        try {
            setError(null)
            setBusy(true)
            await action()
            await onChanged()
        } catch (e) {
            setError(e)
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
        if (!window.confirm(t("comment.confirmDelete"))) return
        run(() => apiDelete(`/comments/${comment.id}`))
    }

    return (
        <div className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-slate-700">
                    {comment.author ? (
                        <Link to={`/users/${comment.author.id}`} className="hover:underline">{comment.author.name}</Link>
                    ) : t("common.unknown")}
                </p>
                {comment.edited_at && <span className="text-xs text-slate-400">{t("common.edited")}</span>}
                {currentUser && !isAuthor && (
                    <div className="ml-auto">
                        <ReportButton commentId={comment.id} />
                    </div>
                )}
                {isAuthor && !editing && (
                    <div className="ml-auto flex gap-2 text-xs">
                        <button type="button" onClick={() => setEditing(true)} className="text-slate-500 hover:text-slate-900">
                            {t("common.edit")}
                        </button>
                        <button type="button" onClick={remove} disabled={busy} className="text-red-600 hover:text-red-800">
                            {t("common.delete")}
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
                        {t("common.save")}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setEditing(false); setText(comment.content) }}
                        className="text-xs text-slate-500"
                    >
                        {t("common.cancel")}
                    </button>
                </form>
            ) : (
                <p className="text-sm text-slate-700">{comment.content}</p>
            )}

            {error && <p className="mt-1 text-xs text-red-700">{errorText(error)}</p>}
        </div>
    )
}

function SolutionCard({ solution, problem, currentUser, onChanged }) {
    const { t, errorText } = useLanguage()
    const [error, setError] = useState(null)
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
            setError(null)
            setBusy(true)
            await action()
            onChanged()
        } catch (e) {
            setError(e)
        } finally {
            setBusy(false)
        }
    }

    async function saveEdit(acknowledged) {
        try {
            setError(null)
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
            setError(e)
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
        if (!window.confirm(t("solution.confirmDelete"))) return
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
            setError(e)
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
            setError(e)
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
                        {t("solution.accepted")}
                    </p>
                    {solution.rating && (
                        <p className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Stars value={solution.rating} className="text-base" />
                            {t("solution.ratedByPoster")}
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
                    <span className="text-sm font-semibold text-slate-900">{t("common.unknown")}</span>
                )}
                {solution.author && <TierBadge tier={solution.author.tier} />}
                {solution.edited_at && <span className="text-xs text-slate-400">{t("common.edited")}</span>}
                {isAuthor && !editing && (
                    <div className="ml-auto flex gap-2">
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                            {t("common.edit")}
                        </button>
                        {!isAccepted && (
                            <button
                                type="button"
                                onClick={deleteSolution}
                                disabled={busy}
                                className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                                {t("common.delete")}
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
                    {busy && (
                        <div className="mt-2">
                            <AiCheckStatus message={t("aiCheck.edit")} />
                        </div>
                    )}
                    <div className="mt-2 flex gap-2">
                        <button
                            type="button"
                            onClick={() => saveEdit(false)}
                            disabled={busy || !editText.trim()}
                            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300"
                        >
                            {busy ? t("common.checking") : t("common.saveChanges")}
                        </button>
                        <button
                            type="button"
                            onClick={cancelEdit}
                            disabled={busy}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            {t("common.cancel")}
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
                    aria-pressed={solution.upvoted}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
                        solution.upvoted
                            ? "border-brand-500 bg-brand-50 text-brand-700"
                            : "border-slate-300 text-slate-700 hover:border-brand-400 hover:text-brand-700"
                    }`}
                    title={!signedIn ? t("solution.signInToUpvote") : solution.upvoted ? t("solution.removeUpvote") : t("solution.upvote")}
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
                            {t("solution.unaccept")}
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
                            {t("solution.accept")}
                        </button>
                    )
                )}

                {canRate && (
                    <button
                        type="button"
                        onClick={() => setRatingOpen((v) => !v)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                        {solution.rating ? t("solution.changeRating") : t("solution.rate")}
                    </button>
                )}

                <button
                    type="button"
                    onClick={toggleComments}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
                >
                    {comments === null ? t("solution.comments") : t("solution.hideComments")}
                </button>

                {signedIn && currentUser?.id !== solution.user_id && (
                    <div className="ml-auto">
                        <ReportButton solutionId={solution.id} />
                    </div>
                )}
            </div>

            {ratingOpen && canRate && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <span className="text-sm text-amber-900">{t("solution.howWell")}</span>
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
                                title={t("common.stars", { count: score })}
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
                        {t("solution.later")}
                    </button>
                </div>
            )}

            {error && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {errorText(error)}
                </p>
            )}

            {comments !== null && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                    {comments.length === 0 && (
                        <p className="text-sm text-slate-500">{t("solution.noComments")}</p>
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
                                placeholder={t("solution.addComment")}
                                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                            />
                            <button
                                type="submit"
                                disabled={busy}
                                className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-40"
                            >
                                {t("solution.send")}
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    )
}

export default SolutionCard
