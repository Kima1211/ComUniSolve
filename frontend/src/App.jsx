import { Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import Register from './components/Register'
import Home from './components/Home'
import PostProblem from './components/PostProblem'
import ProblemDetail from './components/ProblemDetail'
import AdminDashboard from './components/AdminDashboard'
import VerifyEmail from './components/VerifyEmail'
import VerifyNotice from './components/VerifyNotice'
import ForgotPassword from './components/ForgotPassword'
import ResetPassword from './components/ResetPassword'
import RequireAuth from './components/RequireAuth'
import RequireVerified from './components/RequireVerified'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify/:token" element={<VerifyEmail />} />
      <Route path="/verify-email" element={<VerifyNotice />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route path="/" element={<RequireVerified><Home /></RequireVerified>} />
      <Route path="/problems/:id" element={<RequireVerified><ProblemDetail /></RequireVerified>} />

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
