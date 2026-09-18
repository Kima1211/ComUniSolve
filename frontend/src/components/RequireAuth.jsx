import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth-context";

/**
 * Wraps a route's element and only renders it for a permitted user.
 *
 *   <Route path="/postproblem" element={<RequireAuth><PostProblem /></RequireAuth>} />
 *
 * `children` is whatever sits between the opening and closing tags. That is
 * what makes one guard reusable for every protected page instead of copying
 * the same check into each component.
 */
function RequireAuth({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Critical: while the first /users/me call is still in flight, user is null
  // but that does NOT mean logged out - it means "not known yet". Redirecting
  // here would bounce a signed-in user to the login page on every refresh.
  if (loading) {
    return <p>Loading...</p>;
  }

  if (!user) {
    // replace: swap this entry in the history instead of adding one, so the
    // back button does not send them straight back to the blocked page.
    // state.from lets the login page send them where they were going.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (adminOnly && user.role !== "admin") {
    return <p>You do not have permission to view this page.</p>;
  }

  return children;
}

export default RequireAuth;
