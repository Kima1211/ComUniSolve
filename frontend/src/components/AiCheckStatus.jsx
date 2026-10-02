import { useLanguage } from "../i18n/language-context";

function AiCheckStatus({ message }) {
    const { t } = useLanguage()
    return (
        <p role="status" className="flex items-center gap-2 text-sm text-muted">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" aria-hidden="true" />
            {message || t("aiCheck.post")}
        </p>
    )
}

export default AiCheckStatus
