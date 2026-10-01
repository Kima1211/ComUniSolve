import { Navigate } from "react-router-dom";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";

function RequireVerified({ children }) {
    const { user, loading } = useAuth()
    const { t } = useLanguage()

    if (loading) {
        return <p className="p-8 text-sm text-slate-500">{t("common.loading")}</p>
    }

    if (user && !user.is_verified) {
        return <Navigate to="/verify-email" replace />
    }

    return children
}

export default RequireVerified
