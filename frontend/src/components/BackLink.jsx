import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "../i18n/language-context";

// The installed app has no browser back button, so pages offer their own.
// location.key is "default" when the app was opened on this page (nothing to go back to): then it goes to the feed.
function BackLink() {
    const navigate = useNavigate()
    const location = useLocation()
    const { t } = useLanguage()
    const hasHistory = location.key !== "default"

    function goBack(e) {
        if (!hasHistory) return
        e.preventDefault()
        navigate(-1)
    }

    return (
        <Link
            to="/"
            onClick={goBack}
            className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink"
        >
            <ArrowLeft size={18} strokeWidth={1.75} aria-hidden="true" />
            {t("common.back")}
        </Link>
    )
}

export default BackLink
