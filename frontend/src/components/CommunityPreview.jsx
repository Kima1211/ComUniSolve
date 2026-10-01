import { useEffect, useState } from "react";
import { apiGet } from "../api";
import { useLanguage } from "../i18n/language-context";

const HOW_IT_WORKS = [1, 2, 3]

function CommunityPreview() {
    const { t, label } = useLanguage()
    const [problems, setProblems] = useState([])

    useEffect(() => {
        let cancelled = false

        apiGet("/problems")
            .then((data) => {
                if (cancelled) return
                setProblems(Array.isArray(data) ? data.slice(0, 3) : [])
            })
            .catch(() => {
                if (!cancelled) setProblems([])
            })

        return () => { cancelled = true }
    }, [])

    return (
        <div className="hidden lg:flex flex-col justify-center bg-gradient-to-br from-brand-700 to-brand-900 px-12 py-16 text-white">
            <div className="max-w-md">
                <h2 className="text-3xl font-bold leading-tight">
                    {t("preview.headline1")}<br />{t("preview.headline2")}
                </h2>
                <p className="mt-4 text-brand-100">{t("preview.body")}</p>

                {problems.length > 0 ? (
                    <div className="mt-10">
                        <p className="text-xs font-semibold uppercase tracking-wider text-brand-200">
                            {t("preview.recent")}
                        </p>
                        <div className="mt-4 space-y-3">
                            {problems.map((problem) => (
                                <div
                                    key={problem.id}
                                    className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="font-semibold text-white">{problem.title}</h3>
                                        <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-0.5 text-xs text-brand-50">
                                            {label("category", problem.category)}
                                        </span>
                                    </div>
                                    {problem.description && (
                                        <p className="mt-1.5 text-sm text-brand-100 line-clamp-2">
                                            {problem.description}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="mt-10 space-y-5">
                        {HOW_IT_WORKS.map((step) => (
                            <div key={step} className="flex gap-4">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
                                    {step}
                                </span>
                                <div>
                                    <p className="font-semibold">{t(`preview.step${step}Title`)}</p>
                                    <p className="text-sm text-brand-100">{t(`preview.step${step}Body`)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default CommunityPreview
