import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth-context";

function RequireAuth({ children, adminOnly = false }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <p className="p-8 text-sm text-slate-500">Loading...</p>;
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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
