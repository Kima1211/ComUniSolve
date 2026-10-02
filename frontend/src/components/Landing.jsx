import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { apiGet } from "../api";
import { useLanguage } from "../i18n/language-context";
import ProblemFeed, { ProblemCard } from "./ProblemFeed";
import Avatar from "./Avatar";

// What a logged-out visitor sees inside the main feed column: a left-aligned headline
// with one sentence of explanation, a live example of a solved problem on the right,
// then the public feed below. No marketing grid, no feature cards — per DESIGN.md.

function useFirstSolved() {
    const [state, setState] = useState({ loaded: false, solved: null })
    useEffect(() => {
        let cancelled = false
        apiGet("/problems")
            .then((problems) => {
                const solved = problems.find((p) => p.status === "resolved") || null
                if (!cancelled) setState({ loaded: true, solved })
            })
            .catch(() => { if (!cancelled) setState({ loaded: true, solved: null }) })
        return () => { cancelled = true }
    }, [])
    return state
}

// Shown when the platform has no solved problems yet, labelled as an example.
function ExampleCard() {
    const { t } = useLanguage()
    // Lazy state initializer runs ONCE at mount — a sanctioned way to make `Date.now()`
    // call without tripping the "impure call during render" rule useMemo doesn't satisfy.
    const [createdAt] = useState(() => new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    const example = {
        id: 0,
        title: t("post.titlePlaceholder"),
        description: t("landing.exampleBody"),
        category: "Online Services & Apps",
        status: "resolved",
        solution_count: 3,
        created_at: createdAt,
        author: { name: "Juan dela Cruz" },
    }
    return (
        <div>
            <p className="mb-2 text-xs font-medium text-muted">{t("landing.exampleLabel")}</p>
            <div className="rounded-lg border border-border bg-surface p-2 pointer-events-none select-none" aria-hidden="true">
                <ProblemCard problem={example} />
                {/* The accepted-solution banner shown inline, so the gold moment is on-screen. */}
                <div className="mt-2 overflow-hidden rounded-md border-l-[3px] border-gold">
                    <div className="flex items-center gap-2 bg-gold-soft px-3 py-1.5 text-[13px] font-medium text-on-gold-soft banner-fade">
                        <Check size={14} strokeWidth={2.25} />
                        {t("landing.acceptedBanner")}
                    </div>
                    <div className="bg-surface p-3">
                        <div className="flex items-start gap-2.5">
                            <Avatar name="Ella Reyes" size="xs" />
                            <div className="min-w-0">
                                <p className="text-[13px] font-medium text-ink">Ella Reyes</p>
                                <p className="mt-1 text-sm text-ink leading-relaxed">{t("landing.exampleSolution")}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Hero({ solved, loaded }) {
    const { t } = useLanguage()
    return (
        <section className="mb-8 rounded-lg border border-border card-wash p-6">
            <h1 className="text-[40px] font-semibold leading-[1.15] tracking-[-0.01em] text-ink">
                {t("landing.headline")}
            </h1>
            <p className="mt-4 max-w-[55ch] text-base leading-relaxed text-muted">{t("landing.sub")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
                <Link
                    to="/register"
                    className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-hover shine"
                >
                    {t("nav.register")}
                </Link>
                <Link
                    to="/login"
                    className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-semibold text-link hover:bg-surface-2"
                >
                    {t("nav.login")}
                </Link>
            </div>

            <div className="mt-10">
                {!loaded ? (
                    <div className="h-56 animate-pulse rounded-lg border border-border bg-surface-2" />
                ) : solved ? (
                    <div>
                        <p className="mb-2 text-xs font-medium text-muted">{t("landing.livePick")}</p>
                        <div className="rounded-lg border border-border bg-surface p-2">
                            <ProblemCard problem={solved} />
                        </div>
                    </div>
                ) : (
                    <ExampleCard />
                )}
            </div>
        </section>
    )
}

function Landing() {
    const { t } = useLanguage()
    const { solved, loaded } = useFirstSolved()
    const [params] = useSearchParams()
    const searching = Boolean((params.get("q") || "").trim())

    // While a search is active the visitor is looking for something: results first, no hero.
    if (searching) return <ProblemFeed />

    return (
        <div>
            <Hero solved={solved} loaded={loaded} />
            <div className="border-t border-border pt-4">
                <h2 className="pb-3 text-base font-semibold text-ink">{t("landing.recentHeading")}</h2>
                <ProblemFeed />
            </div>
        </div>
    )
}

export default Landing
