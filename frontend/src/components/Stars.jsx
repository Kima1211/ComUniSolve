import { useLanguage } from "../i18n/language-context";

function Stars({ value, className = "" }) {
    const { t } = useLanguage()
    const text = t("common.stars", { count: value })
    return (
        <span className={`tracking-tight ${className}`} aria-label={text} title={text}>
            <span className="text-amber-500">{"★".repeat(value)}</span>
            <span className="text-slate-300">{"★".repeat(5 - value)}</span>
        </span>
    )
}

export default Stars
