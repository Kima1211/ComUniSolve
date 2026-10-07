import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { apiDelete, apiGet, apiPost, imageUrl } from "../api";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";
import { timeAgo } from "../time";
import { useConfirm } from "../confirm-context";
import { Trash2 } from "lucide-react";
import { authorLabel, hasProfile } from "../author";
import Layout, { TierBadge } from "./Layout";
import Avatar from "./Avatar";
import { StatusChip } from "./ProblemFeed";
import SolutionCard from "./SolutionCard";
import SimilarProblems from "./SimilarProblems";
import ModerationNotice from "./ModerationNotice";
import ReportButton from "./ReportButton";
import { alertError } from "../ui";
import EditProblemForm from "./EditProblemForm";
import AiCheckStatus from "./AiCheckStatus";
import BackLink from "./BackLink";

const ghostBase = "inline-flex h-10 items-center rounded-md px-2 text-[13px] font-medium disabled:opacity-50 sm:h-8"
const ghost = `${ghostBase} text-muted hover:bg-surface-2 hover:text-ink`
const danger = `${ghostBase} text-error hover:bg-error-soft`
const ghostLink = `${ghostBase} text-link hover:bg-surface-2`

function ProblemDetail() {
    const { id } = useParams()
    const { user } = useAuth()
    const { t, label, errorText } = useLanguage()
    const imageError = useLocation().state?.imageError
    const navigate = useNavigate()
    const confirm = useConfirm()

    const [problem, setProblem] = useState(null)
    const [solutions, setSolutions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [editing, setEditing] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [ownerError, setOwnerError] = useState(null)

    const [text, setText] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState(null)
    const [solutionGate, setSolutionGate] = useState(null)
    // Keyed by problem and attempt, so opening another problem shows "checking..." instead of the old list.
    const [related, setRelated] = useState({ id: null, attempt: 0, matches: [], aiUsed: false, backup: false })
    const [attempt, setAttempt] = useState(0)

    const [aiSuggestion, setAiSuggestion] = useState(null)
    const suggestionAskedFor = useRef(null)

    useEffect(() => {
        let cancelled = false
        apiGet(`/problems/${id}/similar/ai`)
            .then((data) => {
                if (!cancelled) {
                    setRelated({ id, attempt, matches: data.matches || [], aiUsed: Boolean(data.ai_used), backup: Boolean(data.backup) })
                }
            })
            .catch(() => {
                if (!cancelled) setRelated({ id, attempt, matches: [], aiUsed: false, backup: true })
            })
        return () => { cancelled = true }
    }, [id, attempt])

    const checkingRelated = related.id !== id || related.attempt !== attempt

    const fetchAll = useCallback(
        () => Promise.all([apiGet(`/problems/${id}`), apiGet(`/solutions/problem/${id}`)]),
        [id]
    )

    const load = useCallback(async () => {
        const [p, s] = await fetchAll()
        setProblem(p)
        setSolutions(s)
    }, [fetchAll])

    useEffect(() => {
        let cancelled = false
        fetchAll()
            .then(([p, s]) => { if (!cancelled) { setProblem(p); setSolutions(s) } })
            .catch((e) => { if (!cancelled) setError(e) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [fetchAll])

    useEffect(() => {
        if (loading || !problem || solutions.length > 0) return
        if (suggestionAskedFor.current === id) return
        suggestionAskedFor.current = id

        apiGet(`/problems/${id}/ai-suggestion`)
            .then((data) => setAiSuggestion({ ...data, forId: id }))
            .catch(() => setAiSuggestion({ status: "unavailable", forId: id }))
    }, [id, loading, problem, solutions.length])

    const suggestionPending = !loading && problem && solutions.length === 0 && aiSuggestion?.forId !== id
    const showSuggestion = solutions.length === 0 && aiSuggestion?.forId === id && aiSuggestion.status === "shown"

    async function postSolution(acknowledged) {
        try {
            setSubmitError(null)
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
            setSubmitError(e)
        } finally {
            setSubmitting(false)
        }
    }

    function handleSaved(updated) {
        setProblem(updated)
        setEditing(false)
        // The backend cleared the old AI Suggestion, so ask again for the new text.
        suggestionAskedFor.current = null
        setAiSuggestion(null)
    }

    async function handleDelete() {
        const ok = await confirm({
            title: t("confirm.deleteProblem.title"),
            body: t("confirm.deleteProblem.body"),
            preview: problem.title,
            confirmLabel: t("confirm.deleteProblem.button"),
            Icon: Trash2,
        })
        if (!ok) return
        try {
            setOwnerError(null)
            setDeleting(true)
            await apiDelete(`/problems/${id}`)
            navigate("/")
        } catch (e) {
            setOwnerError(e)
            setDeleting(false)
        }
    }

    function submitSolution(e) {
        e.preventDefault()
        postSolution(false)
    }

    if (loading) {
        return (
            <Layout>
                <div className="h-48 animate-pulse rounded-lg border border-border bg-surface" />
            </Layout>
        )
    }

    if (error || !problem) {
        return (
            <Layout>
                <p className={`${alertError} py-3`}>
                    {error ? errorText(error, "detail.couldNotLoad") : t("detail.notFound")}
                </p>
                <Link to="/" className="mt-4 inline-block text-sm font-medium text-link hover:underline">
                    {t("common.backToFeed")}
                </Link>
            </Layout>
        )
    }

    const isOwner = user && user.id === problem.user_id
    const ordered = [...solutions].sort((a, b) => (b.status === "accepted") - (a.status === "accepted"))
    // With no answer yet, similar solved problems ARE the best answer, so they come first.
    const relatedFirst = solutions.length === 0

    const relatedBlock = checkingRelated ? (
        <AiCheckStatus message={t("detail.checkingSimilar")} />
    ) : (
        <div className="space-y-2">
            <SimilarProblems
                matches={related.matches}
                aiUsed={related.aiUsed}
                backup={related.backup}
                title={t("detail.related")}
                hint={related.aiUsed ? t("detail.relatedHintAi") : null}
            />
            {related.aiUsed && related.matches.length === 0 && (
                <p className="text-sm text-muted">{t("detail.aiNone")}</p>
            )}
            {related.backup && (
                <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                    {related.matches.length === 0 && t("similar.backupNote")}
                    <button type="button" onClick={() => setAttempt((n) => n + 1)} className={ghostLink}>
                        {t("detail.tryAgain")}
                    </button>
                </p>
            )}
        </div>
    )

    const authorName = authorLabel(problem.author, t)

    return (
        <Layout>
            <BackLink />

            {imageError && (
                <p className={`${alertError} mt-3`}>
                    {t("detail.imageNotAdded", { error: imageError })}
                </p>
            )}

            <article className="mt-3 rounded-lg border border-border bg-surface p-4 sm:p-6">
                {editing ? (
                    <EditProblemForm problem={problem} onSaved={handleSaved} onCancel={() => setEditing(false)} />
                ) : (
                    <>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                            <Avatar name={authorName} person={problem.author} size="xs" />
                            <span className="font-medium text-ink">{label("category", problem.category)}</span>
                            <span className="text-muted">
                                {t("detail.postedBy")}{" "}
                                {hasProfile(problem.author) ? (
                                    <Link to={`/users/${problem.author.id}`} className="hover:text-ink hover:underline">{authorName}</Link>
                                ) : authorName}
                            </span>
                            {hasProfile(problem.author) && <TierBadge tier={problem.author.tier} />}
                            <span className="text-muted">{timeAgo(problem.created_at, t)}</span>
                            {problem.edited_at && <span className="text-muted">{t("common.edited")}</span>}
                        </div>

                        <h1 className="mt-2 text-[22px] font-semibold leading-[1.3] text-ink">
                            {problem.title}
                            <span className="ml-2 align-middle"><StatusChip status={problem.status} t={t} /></span>
                        </h1>

                        {problem.description && (
                            <p className="mt-3 max-w-[75ch] whitespace-pre-wrap text-base leading-[1.6] text-ink">
                                {problem.description}
                            </p>
                        )}
                    </>
                )}

                {problem.image_url && (
                    <a href={problem.image_url} target="_blank" rel="noreferrer" className="mt-4 block">
                        <img
                            src={imageUrl(problem.image_url, 1000)}
                            alt={t("detail.photoAlt", { title: problem.title })}
                            className="max-h-[420px] w-full rounded-md border border-border bg-surface-2 object-contain"
                        />
                    </a>
                )}

                {!editing && user && (
                    <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2">
                        {isOwner ? (
                            <>
                                <button type="button" onClick={() => setEditing(true)} className={ghost}>{t("common.edit")}</button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className={danger}
                                >
                                    {deleting ? t("common.deleting") : t("common.delete")}
                                </button>
                            </>
                        ) : (
                            <ReportButton problemId={problem.id} />
                        )}
                    </div>
                )}

                {ownerError && (
                    <p className={`${alertError} mt-3`}>
                        {errorText(ownerError, "detail.couldNotDelete")}
                    </p>
                )}
            </article>

            {relatedFirst && <div className="mt-4">{relatedBlock}</div>}

            <section className="mt-4 rounded-lg border border-border bg-surface p-4">
                <h2 className="text-base font-semibold text-ink">{t("detail.writeSolution")}</h2>

                {!user ? (
                    <p className="mt-2 text-sm text-muted">
                        <Link to="/login" state={{ from: `/problems/${id}` }} className="font-medium text-link hover:underline">
                            {t("detail.signIn")}
                        </Link>
                        {t("detail.toAnswer")}
                    </p>
                ) : !user.is_verified ? (
                    <p className="mt-2 text-sm text-muted">{t("detail.verifyFirst")}</p>
                ) : (
                    <form onSubmit={submitSolution} className="mt-3">
                        <textarea
                            rows={4}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={t("detail.solutionPlaceholder")}
                            aria-label={t("detail.writeSolution")}
                            maxLength={5000}
                            className="w-full rounded-md border border-border px-3 py-2 text-base"
                        />
                        {submitError && (
                            <p className={`${alertError} mt-2`}>
                                {errorText(submitError, "detail.couldNotSubmit")}
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
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                            {submitting && <AiCheckStatus message={t("aiCheck.solution")} />}
                            <button
                                type="submit"
                                disabled={submitting || !text.trim()}
                                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-on-primary
                                           hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 shine"
                            >
                                {submitting ? t("common.checking") : t("detail.postSolution")}
                            </button>
                        </div>
                    </form>
                )}
            </section>

            <section className="mt-6">
                <h2 className="text-base font-semibold text-ink">{t("common.solutions", { count: solutions.length })}</h2>

                <div className="mt-3 space-y-3">
                    {suggestionPending && <AiCheckStatus message={t("detail.suggestionPending")} />}

                    {showSuggestion && (
                        <div className="rounded-lg border border-border bg-surface p-4">
                            <div className="flex flex-wrap items-center gap-2 text-[13px]">
                                <span className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-[12px] font-medium text-ink">
                                    {t("detail.aiSuggestion")}
                                </span>
                                <span className="text-muted">{t("detail.notFromMember")}</span>
                            </div>
                            <p className="mt-2 max-w-[75ch] whitespace-pre-wrap text-base leading-[1.6] text-ink">{aiSuggestion.suggestion}</p>
                            <p className="mt-3 border-t border-border pt-3 text-xs text-muted">{t("detail.aiSuggestionNote")}</p>
                        </div>
                    )}

                    {solutions.length === 0 && !showSuggestion && !suggestionPending && (
                        <p className="py-4 text-sm text-muted">{t("detail.noSolutions")}</p>
                    )}

                    {ordered.length > 0 && (
                        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                            {ordered.map((s) => (
                                <SolutionCard key={s.id} solution={s} problem={problem} currentUser={user} onChanged={load} />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {!relatedFirst && <div className="mt-6">{relatedBlock}</div>}
        </Layout>
    )
}

export default ProblemDetail
