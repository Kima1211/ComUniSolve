import { Link, useLocation, useNavigate } from "react-router-dom";
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
        <Link to="/" onClick={goBack} className="text-sm font-medium text-slate-500 hover:text-slate-900">
            ← {t("common.back")}
        </Link>
    )
}

export default BackLink
