import { Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'
import Home from './components/Home'
import PostProblem from './components/PostProblem'
import ProblemDetail from './components/ProblemDetail'
import AdminDashboard from './components/AdminDashboard'
import VerifyEmail from './components/VerifyEmail'
import VerifyNotice from './components/VerifyNotice'
import RequireAuth from './components/RequireAuth'
import RequireVerified from './components/RequireVerified'

function App() {
  return (
    <Routes>
      {/* Always reachable. /verify/:token must be, or the emailed link could
          never be clicked; /verify-email is the gate itself. */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify/:token" element={<VerifyEmail />} />
      <Route path="/verify-email" element={<VerifyNotice />} />

      {/* Public to guests, closed to signed-in-but-unverified accounts. */}
      <Route path="/" element={<RequireVerified><Home /></RequireVerified>} />
      <Route path="/problems/:id" element={<RequireVerified><ProblemDetail /></RequireVerified>} />

      {/* Signed in only. RequireAuth also sends unverified users to the gate. */}
      <Route
        path="/postproblem"
        element={
          <RequireAuth>
            <PostProblem />
          </RequireAuth>
        }
      />
      <Route
        path="/admin/overview"
        element={
          <RequireAuth adminOnly>
            <AdminDashboard />
          </RequireAuth>
        }
      />
    </Routes>
  )
}

export default App
