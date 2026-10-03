import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth-context";
import LoadingScreen from "./LoadingScreen";

function RequireAuth({ children, adminOnly = false }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <LoadingScreen />;
    }

    if (!user) {
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
