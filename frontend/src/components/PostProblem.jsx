import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost, apiPostForm } from "../api";
import { useLanguage } from "../i18n/language-context";
import Layout from "./Layout";
import SimilarProblems from "./SimilarProblems";
import ModerationNotice from "./ModerationNotice";
import AiCheckStatus from "./AiCheckStatus";
import CategoryOptions from "./CategoryOptions";
import BackLink from "./BackLink";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 " +
    "outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"

function PostProblem() {
    const navigate = useNavigate()
    const { t, errorText } = useLanguage()

    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("")
    const [error, setError] = useState(null)
    const [gate, setGate] = useState(null)
    const [submitting, setSubmitting] = useState(false)
    const [step, setStep] = useState("")
    const [matches, setMatches] = useState([])
    const [aiUsed, setAiUsed] = useState(false)
    const [checkingAi, setCheckingAi] = useState(false)
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

    async function checkWithAI() {
        try {
            setCheckingAi(true)
            const data = await apiPost("/problems/match/ai", { title, description })
            setMatches(data.matches || [])
            setAiUsed(Boolean(data.ai_used))
        } catch {
            // Keep the TF-IDF results already on screen.
        } finally {
            setCheckingAi(false)
        }
    }

    useEffect(() => {
        let cancelled = false
        const timer = setTimeout(() => {
            if (title.trim().length < 6) {
                if (!cancelled) setMatches([])
                return
            }
            apiPost("/problems/match", { title, description })
                .then((data) => {
                    if (cancelled) return
                    setMatches(data.matches || [])
                    setAiUsed(false)
                })
                .catch(() => { if (!cancelled) setMatches([]) })
        }, 600)

        return () => { cancelled = true; clearTimeout(timer) }
    }, [title, description])

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

    return (
        <Layout>
            <div className="mx-auto max-w-2xl">
                <BackLink />
                <h1 className="mt-4 text-xl font-bold text-slate-900">{t("post.title")}</h1>
                <p className="mt-1 text-sm text-slate-500">{t("post.intro")}</p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-6">
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">{t("post.titleLabel")}</label>
                        <input
                            id="title" type="text" className={inputClass} disabled={submitting}
                            placeholder={t("post.titlePlaceholder")}
                            value={title} onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-1">{t("post.description")}</label>
                        <textarea
                            id="description" rows={6} className={inputClass} disabled={submitting}
                            placeholder={t("post.descriptionPlaceholder")}
                            value={description} onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>

                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-slate-700 mb-1">{t("post.category")}</label>
                        <select
                            id="category" className={inputClass} disabled={submitting} required
                            value={category} onChange={(e) => setCategory(e.target.value)}
                        >
                            <CategoryOptions />
                        </select>
                        <p className="mt-1 text-xs text-slate-500">{t("post.categoryHint")}</p>
                    </div>

                    <div>
                        <span className="block text-sm font-medium text-slate-700 mb-1">
                            {t("post.photo")} <span className="font-normal text-slate-400">{t("post.photoHint")}</span>
                        </span>

                        {image ? (
                            <div className="flex items-center gap-3">
                                <img src={preview} alt={t("post.selectedAlt")} className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                                <div className="min-w-0 text-sm">
                                    <p className="truncate text-slate-700">{image.name}</p>
                                    <button
                                        type="button"
                                        disabled={submitting}
                                        onClick={() => setImage(null)}
                                        className="font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                                    >
                                        {t("post.removePhoto")}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <label
                                htmlFor="image"
                                className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed
                                           border-slate-300 px-3 py-4 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-700"
                            >
                                {t("post.choosePhoto")}
                            </label>
                        )}
                        <input
                            id="image" type="file" accept="image/jpeg,image/png,image/webp"
                            className="hidden" disabled={submitting} onChange={chooseImage}
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {errorText(error)}
                        </div>
                    )}

                    <ModerationNotice
                        gate={gate}
                        busy={submitting}
                        onUseSuggestion={useSuggestion}
                        onPostAnyway={() => submitProblem(true)}
                    />

                    {step === "checking" && <AiCheckStatus />}
                    {step === "uploading" && <AiCheckStatus message={t("post.uploading")} />}

                    <button
                        type="submit"
                        disabled={submitting || !title.trim() || !category}
                        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white
                                   hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        {step === "checking" ? t("common.checking") : step === "uploading" ? t("post.submitUploading") : t("post.submit")}
                    </button>
                </form>

                <div className="mt-6">
                    <SimilarProblems
                        matches={matches}
                        aiUsed={aiUsed}
                        hint={t("post.similarHint")}
                    />

                    {aiUsed && matches.length === 0 && (
                        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                            {t("post.aiNoneFound")}
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
                            {checkingAi ? t("post.askingAi") : t("post.searchAi")}
                        </button>
                    )}
                </div>
            </div>
        </Layout>
    )
}

export default PostProblem
