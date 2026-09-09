import { useState } from "react";

function Login() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [error, setError] = useState("")

    async function handleSubmit()  {
        try{
        setError("")
        const response = await fetch("http://localhost:8000/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            credentials: "include",
            body: JSON.stringify({email: email, password: password})
        })
        const data = await response.json()
        
        if (response.ok){
        console.log(data.user,"User Login Succesfully!")
        } else {
        setError(data.detail)
        }

    } catch(e){
        setError(e.message || "Something went wrong! Please try again.")
    }
}

    return (
        <div>
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
        </div>

    )
}

export default Login