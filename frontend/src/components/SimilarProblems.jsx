import { Link } from "react-router-dom";
import { useLanguage } from "../i18n/language-context";
import Stars from "./Stars";

// TF-IDF scores at or above this read as a strong match when the AI didn't judge relevance.
// (Matching itself starts at 0.10, see SIMILARITY_THRESHOLD in Services/matching.py.)
const STRONG_SCORE = 0.35

// DESIGN.md: match strength is written as text ("Strong match" / "Possible match"), never a percentage.
// The exact word-overlap number is kept in the tooltip for anyone who wants it.
function strengthOf(m) {
    if (m.relevance) return m.relevance === "high" ? "strong" : "possible"
    return m.score >= STRONG_SCORE ? "strong" : "possible"
}

// The AI matching panel: Ember Soft background, 12px rounding (DESIGN.md "ai-match-panel").
// backup: the AI couldn't answer, so these are keyword matches only (the panel says so).
function SimilarProblems({ matches, title, hint, aiUsed = false, backup = false }) {
    const { t, label } = useLanguage()
    if (!matches || matches.length === 0) return null

    return (
        <section className="rounded-lg bg-primary-soft p-4">
            <div className="flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink">{title || t("similar.title")}</h2>
                {aiUsed && <span className="shrink-0 text-xs text-muted">{t("similar.aiReviewed")}</span>}
            </div>
            {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
            {backup && <p className="mt-1 text-xs text-muted">{t("similar.backupNote")}</p>}

            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
                {matches.map((m) => {
                    const strength = strengthOf(m)
                    return (
                        <li key={m.id} className="p-3">
                            <Link to={`/problems/${m.id}`} className="font-medium text-ink hover:underline">
                                {m.title}
                            </Link>
                            {m.status === "resolved" && (
                                <span className="ml-2 rounded-sm bg-gold px-1.5 py-0.5 align-middle text-[12px] font-medium text-on-gold shine">
                                    {t("status.solved")}
                                </span>
                            )}

                            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px]">
                                <span className="text-muted">{label("category", m.category)}</span>
                                <span
                                    className={strength === "strong" ? "font-medium text-link" : "text-muted"}
                                    title={t("similar.overlap", { percent: Math.round(m.score * 100) })}
                                >
                                    {strength === "strong" ? t("similar.strong") : t("similar.possible")}
                                </span>
                            </div>

                            {m.reason && <p className="mt-1.5 text-sm text-muted">{m.reason}</p>}

                            {/* The accepted solution's first lines: the reusable answer, marked in gold. */}
                            {m.accepted_solution && (
                                <div className="mt-2 border-l-[3px] border-gold pl-3">
                                    {m.accepted_solution_rating && <Stars value={m.accepted_solution_rating} size={13} />}
                                    <p className="line-clamp-2 text-sm text-ink">{m.accepted_solution}</p>
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}

export default SimilarProblems
