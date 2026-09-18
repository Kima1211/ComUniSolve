import { Routes, Route } from 'react-router-dom'
import './App.css'
import Login from './components/Login'
import Register from './components/Register'
import Home from './components/Home'
import PostProblem from './components/PostProblem'
import AdminDashboard from './components/AdminDashboard'
import VerifyEmail from './components/VerifyEmail'
import RequireAuth from './components/RequireAuth'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify/:token" element={<VerifyEmail />} />

      {}
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
