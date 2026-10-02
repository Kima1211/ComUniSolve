import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth-context";
import { useLanguage } from "../i18n/language-context";

function RequireAuth({ children, adminOnly = false }) {
    const { user, loading } = useAuth();
    const { t } = useLanguage();
    const location = useLocation();

    if (loading) {
        return <p className="p-8 text-sm text-muted">{t("common.loading")}</p>;
    }

    if (!user) {
        // Keep the query too (e.g. /postproblem?title=...), so it survives the login step.
        return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
    }

    if (!user.is_verified) {
        return <Navigate to="/verify-email" replace />;
    }

    if (adminOnly && user.role !== "admin") {
        return <Navigate to="/" replace />;
    }

    return children;
}

export default RequireAuth;
