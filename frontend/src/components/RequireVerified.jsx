import { Navigate } from "react-router-dom";
import { useAuth } from "../auth-context";

/**
 * Blocks a signed-in but unverified account from the app.
 *
 * Note who this does NOT affect: guests. Chapter 4's Figure 2 says a visitor
 * without an account can read public problems, so a logged-out visitor passes
 * straight through. Only someone who has registered and not yet confirmed
 * their email is held at the gate.
 */
function RequireVerified({ children }) {
    const { user, loading } = useAuth()

    // While the first /users/me call is in flight, user is null - which means
    // "not known yet", not "guest". Deciding now would bounce people wrongly
    // on every page refresh.
    if (loading) {
        return <p className="p-8 text-sm text-slate-500">Loading...</p>
    }

    if (user && !user.is_verified) {
        return <Navigate to="/verify-email" replace />
    }

    return children
}

export default RequireVerified
