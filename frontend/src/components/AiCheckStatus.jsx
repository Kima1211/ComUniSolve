import { useLanguage } from "../i18n/language-context";

// Shown while the backend waits on the AI clarity/safety check, so the few-second wait feels intentional.
function AiCheckStatus({ message }) {
    const { t } = useLanguage()
    return (
        <p
            role="status"
            className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm text-purple-800"
        >
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-purple-500" />
            {message || t("aiCheck.post")}
        </p>
    )
}

export default AiCheckStatus
