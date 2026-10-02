import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiPost, apiPostForm } from "../api";
import { ImagePlus } from "lucide-react";
import { useLanguage } from "../i18n/language-context";
import { inputClass } from "../form";
import { alertError, btnPrimary, pageSub, pageTitle, panel } from "../ui";
import Layout from "./Layout";
import FormField from "./FormField";
import SimilarProblems from "./SimilarProblems";
import ModerationNotice from "./ModerationNotice";
import AiCheckStatus from "./AiCheckStatus";
import CategoryOptions from "./CategoryOptions";
import BackLink from "./BackLink";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
// The AI check runs once the title has 2+ words and 12+ characters and typing has paused this long
// (protects the free Gemini quota: about 1-3 calls while someone writes a title).
const MATCH_DELAY_MS = 1200
const NO_MATCH = { query: "", matches: [], aiUsed: false, backup: false }
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

function PostProblem() {
    const navigate = useNavigate()
    const { t, errorText } = useLanguage()
    const [params] = useSearchParams()

    // Coming from a search with no results (/postproblem?title=...): start with those words.
    // Read once at mount; after that the box is the user's to edit.
    const [title, setTitle] = useState(() => (params.get("title") || "").slice(0, 255))
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("")
    const [error, setError] = useState(null)
    const [gate, setGate] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [step, setStep] = useState("")
    // The last answer, remembered with the title it was for, so a changed title shows "looking..."
    const [match, setMatch] = useState(NO_MATCH)
    const [image, setImage] = useState(null)

    const preview = useMemo(() => (image ? URL.createObjectURL(image) : ""), [image])
    useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

    function chooseImage(e) {
        const file = e.target.files[0]
        e.target.value = ""
        if (!file) return

        if (!IMAGE_TYPES.includes(file.type)) {
            setError({ key: "error.image_type" })
            return
        }
        if (file.size > MAX_IMAGE_BYTES) {
            setError({ key: "error.image_too_large" })
            return
        }
        setError(null)
        setImage(file)
    }

    // Similar problems, judged by the AI (the keyword backup steps in if the AI is unavailable).
    // Only title changes start a check; the description is sent along but typing it doesn't
    // trigger new calls, so the ref holds its latest value.
    const query = title.trim()
    const readyToMatch = query.split(/\s+/).length >= 2 && query.length >= 12
    const descriptionRef = useRef(description)
    useEffect(() => { descriptionRef.current = description }, [description])

    useEffect(() => {
        if (!readyToMatch) return
        let cancelled = false
        const timer = setTimeout(() => {
            apiPost("/problems/match/ai", { title: query, description: descriptionRef.current })
                .then((data) => {
                    if (!cancelled) {
                        setMatch({ query, matches: data.matches || [], aiUsed: Boolean(data.ai_used), backup: Boolean(data.backup) })
                    }
                })
                .catch(() => { if (!cancelled) setMatch({ ...NO_MATCH, query, backup: true }) })
        }, MATCH_DELAY_MS)
        return () => { cancelled = true; clearTimeout(timer) }
    }, [query, readyToMatch])

    // While a new check is pending, the previous results stay visible under a "looking..." line.
    const current = readyToMatch ? match : NO_MATCH
    const matching = readyToMatch && match.query !== query

    async function submitProblem(acknowledged) {
        try {
            setError(null)
            setGate(null)
            setSubmitting(true)
            setStep("checking")
            const data = await apiPost("/problems", { title, description, category, acknowledged })

            // Passed to the problem page as text, so it's translated here, in the language in use right now.
            let imageError = ""
            if (image) {
                setStep("uploading")
                try {
                    const form = new FormData()
                    form.append("image", image)
                    await apiPostForm(`/problems/${data.id}/image`, form)
                } catch (e) {
                    imageError = errorText(e, "post.imageFailed")
                }
            }
            navigate(`/problems/${data.id}`, { state: { imageError } })
        } catch (e) {
            if (e.status === 401) { navigate('/login'); return }
            if (e.status === 422 && e.detail?.verdict) {
                setGate(e.detail)
                return
            }
            setError(e)
        } finally {
            setSubmitting(false)
            setStep("")
        }
    }

    function handleSubmit(e) {
        e.preventDefault()
        submitProblem(false)
    }

    function useSuggestion(text) {
        setDescription(text)
        setGate(null)
    }

    // The AI matching panel (the core feature). Desktop: in the right rail from the start.
    // Smaller screens: right under the title, once the title is long enough to match on.
    const matchPanel = (
        <div className="space-y-2">
            {current.matches.length > 0 ? (
                <SimilarProblems
                    matches={current.matches}
                    aiUsed={current.aiUsed}
                    backup={current.backup}
                    hint={t("post.similarHint")}
                />
            ) : (
                <section className="rounded-lg bg-primary-soft p-4">
                    <h2 className="text-sm font-semibold text-ink">{t("similar.title")}</h2>
                    {!matching && (
                        <p className="mt-1 text-sm text-muted">
                            {current.aiUsed ? t("post.aiNoneFound") : current.backup ? t("similar.backupNote") : t("post.matchHint")}
                        </p>
                    )}
                </section>
            )}
            {matching && <AiCheckStatus message={t("post.matching")} />}
        </div>
    )

    return (
        <Layout rail={<div className="sticky top-20">{matchPanel}</div>}>
            <BackLink />
            <h1 className={`${pageTitle} mt-2`}>{t("post.title")}</h1>
            <p className={pageSub}>{t("post.intro")}</p>

            <form onSubmit={handleSubmit} noValidate className={`${panel} mt-4 space-y-5`}>
                <FormField id="category" label={t("post.category")} hint={t("post.categoryHint")}>
                    <select
                        id="category" className={inputClass()} disabled={submitting} required
                        value={category} onChange={(e) => setCategory(e.target.value)}
                    >
                        <CategoryOptions />
                    </select>
                </FormField>

                <div>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                        <label htmlFor="title" className="block text-sm font-medium text-ink">{t("post.titleLabel")}</label>
                        <span className="text-xs tabular-nums text-muted" aria-hidden="true">{title.length}/255</span>
                    </div>
                    <input
                        id="title" type="text" className={inputClass()} disabled={submitting} maxLength={255}
                        placeholder={t("post.titlePlaceholder")}
                        value={title} onChange={(e) => setTitle(e.target.value)}
                    />
                </div>

                {readyToMatch && <div className="xl:hidden">{matchPanel}</div>}

                <FormField id="description" label={t("post.description")}>
                    <textarea
                        id="description" rows={6} className={`${inputClass()} text-base leading-[1.6]`}
                        disabled={submitting} maxLength={5000}
                        placeholder={t("post.descriptionPlaceholder")}
                        value={description} onChange={(e) => setDescription(e.target.value)}
                    />
                </FormField>

                <div>
                    <span className="mb-1 block text-sm font-medium text-ink">
                        {t("post.photo")} <span className="font-normal text-muted">{t("post.photoHint")}</span>
                    </span>
                    {image ? (
                        <div className="flex items-center gap-3">
                            <img src={preview} alt={t("post.selectedAlt")} className="h-20 w-20 rounded-md border border-border object-cover" />
                            <div className="min-w-0 text-sm">
                                <p className="truncate text-ink">{image.name}</p>
                                <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => setImage(null)}
                                    className="mt-1 font-medium text-error hover:underline disabled:opacity-50"
                                >
                                    {t("post.removePhoto")}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <label
                            htmlFor="image"
                            className="flex min-h-20 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed
                                       border-border-strong px-3 py-4 text-sm text-muted hover:border-link hover:text-link"
                        >
                            <ImagePlus size={18} strokeWidth={1.75} aria-hidden="true" />
                            {t("post.choosePhoto")}
                        </label>
                    )}
                    <input
                        id="image" type="file" accept="image/jpeg,image/png,image/webp"
                        className="sr-only" disabled={submitting} onChange={chooseImage}
                    />
                </div>

                {error && <div role="alert" className={alertError}>{errorText(error)}</div>}

                <ModerationNotice
                    gate={gate}
                    busy={submitting}
                    onUseSuggestion={useSuggestion}
                    onPostAnyway={() => submitProblem(true)}
                />

                {/* Actions at the bottom right (DESIGN.md); the one primary button on this page. */}
                <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
                    {step === "checking" && <AiCheckStatus />}
                    {step === "uploading" && <AiCheckStatus message={t("post.uploading")} />}
                    <button
                        type="submit"
                        disabled={submitting || !title.trim() || !category}
                        className={btnPrimary}
                    >
                        {step === "checking" ? t("common.checking") : step === "uploading" ? t("post.submitUploading") : t("post.submit")}
                    </button>
                </div>
            </form>
        </Layout>
    )
}

export default PostProblem
