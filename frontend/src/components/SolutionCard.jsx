import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowBigUp, Check, MessageSquare, Star, Trash2 } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPatch } from "../api";
import { useLanguage } from "../i18n/language-context";
import { timeAgo } from "../time";
import { useConfirm } from "../confirm-context";
import { authorLabel, hasProfile } from "../author";
import { TierBadge } from "./Layout";
import Avatar from "./Avatar";
import ReportButton from "./ReportButton";
import ModerationNotice from "./ModerationNotice";
import Stars from "./Stars";
import AiCheckStatus from "./AiCheckStatus";

const ghostBase = "inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium disabled:opacity-40 sm:h-8"
const ghost = `${ghostBase} text-muted hover:bg-surface-2 hover:text-ink`
const danger = `${ghostBase} text-error hover:bg-error-soft`
const secondary = "inline-flex h-10 items-center rounded-md border border-border bg-surface px-3 text-[13px] font-semibold text-link hover:bg-surface-2 disabled:opacity-40 sm:h-8"

function CommentItem({ comment, currentUser, onChanged }) {
    const { t, errorText } = useLanguage()
    const [editing, setEditing] = useState(false)
    const [text, setText] = useState(comment.content)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)

    const isAuthor = currentUser && currentUser.id === comment.user_id
    const confirm = useConfirm()

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

    async function remove() {
        const ok = await confirm({
            title: t("confirm.deleteComment.title"),
            body: t("confirm.deleteComment.body"),
            preview: comment.content,
            confirmLabel: t("confirm.deleteComment.button"),
            Icon: Trash2,
        })
        if (!ok) return
        run(() => apiDelete(`/comments/${comment.id}`))
    }

    return (
        <div className="py-2">
            <div className="flex flex-wrap items-center gap-x-2 text-[13px]">
                {hasProfile(comment.author) ? (
                    <Link to={`/users/${comment.author.id}`} className="font-medium text-ink hover:underline">{comment.author.name}</Link>
                ) : (
                    <span className="font-medium text-ink">{authorLabel(comment.author, t)}</span>
                )}
                <span className="text-muted">{timeAgo(comment.created_at, t)}</span>
                {comment.edited_at && <span className="text-muted">{t("common.edited")}</span>}
                {isAuthor && !editing && (
                    <span className="ml-auto flex gap-1">
                        <button type="button" onClick={() => setEditing(true)} className={ghost}>{t("common.edit")}</button>
                        <button type="button" onClick={remove} disabled={busy} className={danger}>
                            {t("common.delete")}
                        </button>
                    </span>
                )}
            </div>

            {editing ? (
                <form onSubmit={save} className="mt-1 flex gap-2">
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        maxLength={2000}
                        className="h-10 flex-1 rounded-md border border-border px-3 text-sm"
                    />
                    <button type="submit" disabled={busy || !text.trim()} className={secondary}>{t("common.save")}</button>
                    <button type="button" onClick={() => { setEditing(false); setText(comment.content) }} className={ghost}>
                        {t("common.cancel")}
                    </button>
                </form>
            ) : (
                <p className="mt-0.5 text-sm leading-relaxed text-ink">{comment.content}</p>
            )}

            {currentUser && !isAuthor && !editing && <ReportButton commentId={comment.id} />}
            {error && <p className="mt-1 text-sm text-error">{errorText(error)}</p>}
        </div>
    )
}

function RatePicker({ current, busy, onPick, onLater }) {
    const { t } = useLanguage()
    const [hover, setHover] = useState(0)
    const shown = hover || current || 0
    return (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-surface-2 px-3 py-2">
            <span className="text-sm text-ink">{t("solution.howWell")}</span>
            <div className="flex" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((score) => (
                    <button
                        key={score}
                        type="button"
                        disabled={busy}
                        onClick={() => onPick(score)}
                        onMouseEnter={() => setHover(score)}
                        onFocus={() => setHover(score)}
                        onBlur={() => setHover(0)}
                        aria-label={t("common.stars", { count: score })}
                        className="flex h-11 w-10 items-center justify-center disabled:opacity-40"
                    >
                        <Star
                            size={24}
                            strokeWidth={1.75}
                            aria-hidden="true"
                            className={score <= shown ? "fill-gold text-on-gold" : "fill-none text-border-strong"}
                        />
                    </button>
                ))}
            </div>
            <button type="button" onClick={onLater} className={`${ghost} ml-auto`}>{t("solution.later")}</button>
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
    const canRate = isProblemOwner && isAccepted && !isAuthor
    const confirm = useConfirm()

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

    async function deleteSolution() {
        const ok = await confirm({
            title: t("confirm.deleteSolution.title"),
            body: t("confirm.deleteSolution.body"),
            preview: solution.solution_text,
            confirmLabel: t("confirm.deleteSolution.button"),
            Icon: Trash2,
        })
        if (!ok) return
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

    const authorName = authorLabel(solution.author, t)

    return (
        <article className={`bg-surface ${isAccepted ? "border-l-[3px] border-gold" : ""}`}>
            {isAccepted && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-gold-soft px-4 py-2 text-[13px] font-medium text-on-gold-soft banner-fade">
                    <span className="inline-flex items-center gap-1.5">
                        <Check size={16} strokeWidth={2.25} aria-hidden="true" />
                        {t("solution.acceptedByPoster")}
                    </span>
                    {solution.rating && (
                        <span className="inline-flex items-center gap-1.5">
                            <Stars value={solution.rating} size={14} />
                            <span aria-hidden="true">{t("common.outOfFive", { count: solution.rating })}</span>
                        </span>
                    )}
                </div>
            )}

            <div className="p-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                    <Avatar name={authorName} size="xs" />
                    {hasProfile(solution.author) ? (
                        <Link to={`/users/${solution.author.id}`} className="font-medium text-ink hover:underline">{authorName}</Link>
                    ) : (
                        <span className="font-medium text-ink">{authorName}</span>
                    )}
                    {hasProfile(solution.author) && <TierBadge tier={solution.author.tier} />}
                    <span className="text-muted">{timeAgo(solution.created_at, t)}</span>
                    {solution.edited_at && <span className="text-muted">{t("common.edited")}</span>}
                    {isAuthor && !editing && (
                        <span className="ml-auto flex gap-1">
                            <button type="button" onClick={() => setEditing(true)} className={ghost}>{t("common.edit")}</button>
                            {!isAccepted && (
                                <button type="button" onClick={deleteSolution} disabled={busy} className={danger}>
                                    {t("common.delete")}
                                </button>
                            )}
                        </span>
                    )}
                </div>

                {editing ? (
                    <div className="mt-3">
                        <textarea
                            rows={4}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            maxLength={5000}
                            className="w-full rounded-md border border-border px-3 py-2 text-base"
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
                        {busy && <div className="mt-2"><AiCheckStatus message={t("aiCheck.edit")} /></div>}
                        <div className="mt-2 flex justify-end gap-2">
                            <button type="button" onClick={cancelEdit} disabled={busy} className={ghost}>{t("common.cancel")}</button>
                            <button type="button" onClick={() => saveEdit(false)} disabled={busy || !editText.trim()} className={secondary}>
                                {busy ? t("common.checking") : t("common.saveChanges")}
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="mt-2 max-w-[75ch] whitespace-pre-wrap text-base leading-[1.6] text-ink">{solution.solution_text}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={!signedIn || busy}
                        onClick={() => run(() => apiPost(`/solutions/${solution.id}/upvote`))}
                        aria-pressed={solution.upvoted}
                        title={!signedIn ? t("solution.signInToUpvote") : solution.upvoted ? t("solution.removeUpvote") : t("solution.upvote")}
                        aria-label={`${!signedIn ? t("solution.signInToUpvote") : solution.upvoted ? t("solution.removeUpvote") : t("solution.upvote")}: ${solution.upvote_count}`}
                        className={`inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors duration-150 disabled:opacity-60 sm:h-8 ${
                            solution.upvoted ? "bg-primary-soft text-link" : "bg-surface-2 text-ink hover:bg-border"
                        }`}
                    >
                        <ArrowBigUp size={18} strokeWidth={1.75} aria-hidden="true" className={solution.upvoted ? "fill-link" : ""} />
                        <span className="tabular-nums">{solution.upvote_count}</span>
                    </button>

                    {isProblemOwner && (
                        isAccepted ? (
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => run(() => apiPatch(`/solutions/${solution.id}/unaccept`))}
                                className={ghost}
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
                                        if (!isAuthor) setRatingOpen(true)
                                    })
                                }
                                className={secondary}
                            >
                                <Check size={14} strokeWidth={2.25} aria-hidden="true" className="mr-1" />
                                {t("solution.accept")}
                            </button>
                        )
                    )}

                    {canRate && (
                        <button type="button" onClick={() => setRatingOpen((v) => !v)} className={ghost}>
                            <Star size={14} strokeWidth={1.75} aria-hidden="true" />
                            {solution.rating ? t("solution.changeRating") : t("solution.rate")}
                        </button>
                    )}

                    <button type="button" onClick={toggleComments} aria-expanded={comments !== null} className={ghost}>
                        <MessageSquare size={14} strokeWidth={1.75} aria-hidden="true" />
                        {comments === null ? t("solution.comments") : t("solution.hideComments")}
                    </button>

                    {signedIn && !isAuthor && (
                        <span className="ml-auto">
                            <ReportButton solutionId={solution.id} />
                        </span>
                    )}
                </div>

                {ratingOpen && canRate && (
                    <RatePicker
                        current={solution.rating}
                        busy={busy}
                        onLater={() => setRatingOpen(false)}
                        onPick={(score) =>
                            run(async () => {
                                await apiPost(`/solutions/${solution.id}/rate`, { score, feedback: null })
                                setRatingOpen(false)
                            })
                        }
                    />
                )}

                {error && (
                    <p className="mt-3 rounded-md bg-error-soft px-3 py-2 text-sm text-error">{errorText(error)}</p>
                )}

                {comments !== null && (
                    <div className="thread-line mt-3">
                        {comments.length === 0 && <p className="py-2 text-sm text-muted">{t("solution.noComments")}</p>}
                        {comments.map((c) => (
                            <CommentItem key={c.id} comment={c} currentUser={currentUser} onChanged={reloadComments} />
                        ))}

                        {signedIn && (
                            <form onSubmit={submitComment} className="mt-2 flex gap-2">
                                <input
                                    type="text"
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder={t("solution.addComment")}
                                    aria-label={t("solution.addComment")}
                                    maxLength={2000}
                                    className="h-10 min-w-0 flex-1 rounded-md border border-border px-3 text-sm"
                                />
                                <button type="submit" disabled={busy || !commentText.trim()} className={`${secondary} h-10 sm:h-10`}>
                                    {t("solution.send")}
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </article>
    )
}

export default SolutionCard
