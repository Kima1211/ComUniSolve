import { Routes,Route } from 'react-router-dom'
import './App.css'
import Login from './components/Login'
import Register from './components/Register'
import Home from './components/Home'

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
    </Routes>
  
  )
}

export default App
