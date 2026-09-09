import { useState } from "react";
import { Link } from "react-router-dom";

function Register() {
    const [name, setName] = useState("")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    async function handleSubmit() {
        try{
            setError("")
                const response = await fetch("http://localhost:8000/register", {
                    method: "POST", 
                    headers: {"Content-Type": "application/json"},
                    credentials: "include",
                    body: JSON.stringify({name: name, email: email, password: password})
        })
        const data = await response.json()

        if (response.ok){
            console.log(data.data,"User registered succesfully!")
        } else {
            setError(data.detail)
        }
        } catch (e){
            setError(e.message || "Something went wrong! Please try again.")
        }
    }
    return (
        <div>
            <input 
            type="text"
            placeholder="Enter your name"
            value={name} onChange={(e) => setName(e.target.value)}
            />

            <input 
            type="email"
            placeholder="Enter your email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            />

            <input 
            type="password"
            placeholder="Enter your password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            />

            <button type="button" 
            className="submit" 
            onClick={handleSubmit}>Submit</button>
            {error && <p style={{ color: 'red', marginTop: '5px' }}>{error}</p>}  

            <Link to="/login">Log In</Link>
        </div>
    )
}

export default Register
