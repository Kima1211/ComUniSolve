import { useLanguage } from "../i18n/language-context";

function ModerationNotice({ gate, onUseSuggestion, onPostAnyway, busy }) {
    const { t } = useLanguage()
    if (!gate) return null

    const canOverride = Boolean(gate.acknowledgeable)

    const tone = canOverride
        ? { box: "border-amber-300 bg-amber-50", head: "text-amber-900", body: "text-amber-800" }
        : { box: "border-red-300 bg-red-50", head: "text-red-900", body: "text-red-800" }

    // The keyword message is ours, so it's translated; AI messages already follow the language of the post.
    const message = gate.code === "keyword_blocked" ? t("mod.keywordBlocked") : gate.message

    return (
        <div className={`rounded-lg border px-4 py-3 ${tone.box}`}>
            <p className={`text-sm font-semibold ${tone.head}`}>
                {canOverride ? t("mod.mayBeUnclear") : t("mod.cannotSubmit")}
            </p>

            <p className={`mt-1 text-sm ${tone.body}`}>{message}</p>

            {gate.matched_terms?.length > 0 && (
                <p className={`mt-2 text-xs ${tone.body}`}>
                    {t("mod.found")} {gate.matched_terms.map((term) => (
                        <span key={term} className="mx-0.5 rounded bg-white/70 px-1.5 py-0.5 font-mono">{term}</span>
                    ))}
                </p>
            )}

            {gate.suggestion && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {t("mod.suggested")}
                    </p>
                    <p className="mt-1 text-sm text-slate-800">{gate.suggestion}</p>
                    {onUseSuggestion && (
                        <button
                            type="button"
                            onClick={() => onUseSuggestion(gate.suggestion)}
                            disabled={busy}
                            className="mt-2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white
                                       hover:bg-brand-700 disabled:bg-slate-300"
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
                    className="mt-3 text-xs font-medium text-amber-900 underline underline-offset-2
                               hover:text-amber-950 disabled:opacity-50"
                >
                    {busy ? t("mod.posting") : t("mod.postAnyway")}
                </button>
            )}
        </div>
    )
}

export default ModerationNotice
