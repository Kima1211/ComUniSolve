import { Routes,Route } from 'react-router-dom'
import './App.css'
import Login from './components/Login'
import Register from './components/Register'
import Home from './components/Home'
import PostProblem from './components/PostProblem'

function App() {
  return (
    <Routes>
      <Route 
        path="/"
        element={<Home />} />
      <Route 
          path="/login" 
          element={<Login />}/>
      <Route 
          path="/register" 
          element={<Register />}/>
        <Route 
          path="/postproblem" 
          element={<PostProblem />}/>
    </Routes>
  
  )
}

export default App
