import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "../i18n/language-context";
import Stars from "./Stars";

const STRONG_SCORE = 0.35

function strengthOf(m) {
    if (m.relevance) return m.relevance === "high" ? "strong" : "possible"
    return m.score >= STRONG_SCORE ? "strong" : "possible"
}

function SimilarProblems({ matches, title, hint, aiUsed = false, backup = false, collapsible = false }) {
    const { t, label } = useLanguage()
    const [open, setOpen] = useState(!collapsible)
    if (!matches || matches.length === 0) return null

    const heading = title || t("similar.title")

    return (
        <section className={`rounded-lg bg-primary-soft ${collapsible ? "px-4 py-2" : "p-4"}`}>
            <div className="flex items-center justify-between gap-3">
                <h2 className="min-w-0 flex-1 text-sm font-semibold text-ink">
                    {collapsible ? (
                        <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setOpen((o) => !o)}
                            className="flex min-h-10 w-full items-center gap-1.5 text-left hover:underline sm:min-h-8"
                        >
                            <ChevronRight size={16} aria-hidden="true" className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
                            {heading} ({matches.length})
                        </button>
                    ) : heading}
                </h2>
                {aiUsed && <span className="shrink-0 text-xs text-muted">{t("similar.aiReviewed")}</span>}
            </div>

            {open && (
                <div className={collapsible ? "pb-2" : ""}>
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
                </div>
            )}
        </section>
    )
}

export default SimilarProblems
