import { Navigate } from "react-router-dom";
import { useAuth } from "../auth-context";

function RequireVerified({ children }) {
    const { user, loading } = useAuth()

    if (loading) {
        return <p className="p-8 text-sm text-slate-500">Loading...</p>
    }

    if (user && !user.is_verified) {
        return <Navigate to="/verify-email" replace />
    }

    return children
}

export default RequireVerified
