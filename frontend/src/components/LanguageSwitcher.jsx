import { useLanguage } from "../i18n/language-context";

const OPTIONS = [
    ["en", "EN"],
    ["tl", "TL"],
]

// Two small buttons instead of a dropdown, so it fits in the top bar on phones.
// Active side uses primary-soft + primary text; inactive is a quiet ghost.
function LanguageSwitcher() {
    const { lang, setLang, t } = useLanguage()

    return (
        <div role="group" aria-label={t("lang.label")} className="flex overflow-hidden rounded-md border border-border text-xs font-semibold">
            {OPTIONS.map(([value, text]) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => setLang(value)}
                    aria-pressed={lang === value}
                    className={`px-2.5 py-1.5 ${
                        lang === value ? "bg-primary-soft text-link" : "bg-surface text-muted hover:bg-surface-2 hover:text-ink"
                    }`}
                >
                    {text}
                </button>
            ))}
        </div>
    )
}

export default LanguageSwitcher
