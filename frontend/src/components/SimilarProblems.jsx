import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/language-context";
import Stars from "./Stars";

const RELEVANCE_STYLES = {
    high: "bg-emerald-100 text-emerald-800",
    medium: "bg-sky-100 text-sky-800",
    low: "bg-slate-100 text-slate-600",
}

function SimilarProblems({ matches, title, hint, aiUsed = false }) {
    const { t, label } = useLanguage()
    if (!matches || matches.length === 0) return null

    return (
        <section className="rounded-xl border border-brand-200 bg-brand-50/60 p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold text-brand-900">{title || t("similar.title")}</h2>
                    {hint && <p className="mt-1 text-xs text-brand-800/80">{hint}</p>}
                </div>
                {aiUsed && (
                    <span className="shrink-0 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                        {t("similar.aiReviewed")}
                    </span>
                )}
            </div>

            <div className="mt-4 space-y-3">
                {matches.map((m) => (
                    <div key={m.id} className="rounded-lg border border-brand-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                            <Link
                                to={`/problems/${m.id}`}
                                className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
                            >
                                {m.title}
                            </Link>
                            <div className="flex shrink-0 items-center gap-1.5">
                                {m.relevance && (
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                            RELEVANCE_STYLES[m.relevance] || RELEVANCE_STYLES.low
                                        }`}
                                    >
                                        {label("similar.relevance", m.relevance)}
                                    </span>
                                )}
                                <span
                                    className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800"
                                    title={t("similar.wordsTitle")}
                                >
                                    {t("similar.words", { percent: Math.round(m.score * 100) })}
                                </span>
                            </div>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                                {label("category", m.category)}
                            </span>
                            {m.status === "resolved" && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">
                                    {t("common.resolved")}
                                </span>
                            )}
                        </div>

                        {m.reason && (
                            <p className="mt-2 text-sm italic text-slate-600">
                                <span className="font-medium not-italic text-purple-700">{t("similar.ai")}</span> {m.reason}
                            </p>
                        )}

                        {m.accepted_solution && (
                            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-xs font-semibold text-amber-800">{t("solution.accepted")}</p>
                                    {m.accepted_solution_rating && (
                                        <Stars value={m.accepted_solution_rating} className="text-sm" />
                                    )}
                                </div>
                                <p className="mt-1 text-sm text-slate-700 line-clamp-3">
                                    {m.accepted_solution}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </section>
    )
}

export default SimilarProblems
