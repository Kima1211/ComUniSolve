import { Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'
import Home from './components/Home'
import PostProblem from './components/PostProblem'
import ProblemDetail from './components/ProblemDetail'
import AdminDashboard from './components/AdminDashboard'
import VerifyNotice from './components/VerifyNotice'
import ForgotPassword from './components/ForgotPassword'
import ResetPassword from './components/ResetPassword'
import RequireAuth from './components/RequireAuth'
import RequireVerified from './components/RequireVerified'
import UserProfile from './components/UserProfile'
import EditProfile from './components/EditProfile'
import NotFound from './components/NotFound'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyNotice />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route path="/" element={<RequireVerified><Home /></RequireVerified>} />
      <Route path="/problems/:id" element={<RequireVerified><ProblemDetail /></RequireVerified>} />
      <Route path="/users/:id" element={<RequireVerified><UserProfile /></RequireVerified>} />
      <Route path="/profile" element={<RequireAuth><UserProfile own /></RequireAuth>} />
      <Route path="/profile/edit" element={<RequireAuth><EditProfile /></RequireAuth>} />

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

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
