import { useLanguage } from "../i18n/language-context";

// The pre-post moderation result. Blocked posts use Error Soft (DESIGN.md: "rejected posts and
// moderation warnings"). "May be unclear" is a neutral note, not red: the user can still post it.
function ModerationNotice({ gate, onUseSuggestion, onPostAnyway, busy }) {
    const { t } = useLanguage()
    if (!gate) return null

    const canOverride = Boolean(gate.acknowledgeable)

    const tone = canOverride
        ? { box: "border-border bg-surface-2", head: "text-ink", body: "text-ink" }
        : { box: "border-transparent bg-error-soft", head: "text-error", body: "text-error" }

    // The keyword message is ours, so it's translated; AI messages already follow the language of the post.
    const message = gate.code === "keyword_blocked" ? t("mod.keywordBlocked") : gate.message

    return (
        <div role="alert" className={`rounded-md border px-3 py-3 ${tone.box}`}>
            <p className={`text-sm font-semibold ${tone.head}`}>
                {canOverride ? t("mod.mayBeUnclear") : t("mod.cannotSubmit")}
            </p>

            <p className={`mt-1 text-sm ${tone.body}`}>{message}</p>

            {gate.matched_terms?.length > 0 && (
                <p className={`mt-2 text-xs ${tone.body}`}>
                    {t("mod.found")} {gate.matched_terms.map((term) => (
                        <span key={term} className="mx-0.5 rounded-sm bg-surface px-1.5 py-0.5 font-mono">{term}</span>
                    ))}
                </p>
            )}

            {gate.suggestion && (
                <div className="mt-3 rounded-md border border-border bg-surface p-3">
                    <p className="text-xs font-medium text-muted">{t("mod.suggested")}</p>
                    <p className="mt-1 text-sm text-ink">{gate.suggestion}</p>
                    {onUseSuggestion && (
                        <button
                            type="button"
                            onClick={() => onUseSuggestion(gate.suggestion)}
                            disabled={busy}
                            className="mt-2 inline-flex h-8 items-center rounded-md border border-border bg-surface px-3 text-xs font-semibold text-link
                                       hover:bg-surface-2 disabled:opacity-50"
                        >
                            {t("mod.useThis")}
                        </button>
                    )}
                </div>
            )}

            {canOverride && onPostAnyway && (
                <button
                    type="button"
                    onClick={onPostAnyway}
                    disabled={busy}
                    className="mt-3 text-xs font-medium text-muted underline underline-offset-2 hover:text-ink disabled:opacity-50"
                >
                    {busy ? t("mod.posting") : t("mod.postAnyway")}
                </button>
            )}
        </div>
    )
}

export default ModerationNotice
