import { useLanguage } from "../i18n/language-context";

const OPTIONS = [
    ["en", "EN"],
    ["tl", "TL"],
]

// Two small buttons instead of a dropdown, so it fits in the header on phones.
function LanguageSwitcher() {
    const { lang, setLang, t } = useLanguage()

    return (
        <div role="group" aria-label={t("lang.label")} className="flex overflow-hidden rounded-lg border border-slate-300 text-xs font-semibold">
            {OPTIONS.map(([value, text]) => (
                <button
                    key={value}
                    type="button"
                    onClick={() => setLang(value)}
                    aria-pressed={lang === value}
                    className={`px-2 py-1 ${
                        lang === value ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                >
                    {text}
                </button>
            ))}
        </div>
    )
}

export default LanguageSwitcher
