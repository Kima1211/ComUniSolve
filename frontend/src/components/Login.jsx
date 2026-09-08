import { useState } from "react";

function Login() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")

    function handleSubmit() {
        fetch("http://localhost:8000/login", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            credentials: "include",
            body: JSON.stringify({email: email, password: password})
        })
        .then((response) => response.json())
        .then((data) => {console.log(data.user)})

        .catch((error) => {
            console.log("Something went wrong:", error)
        })
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
        </div>

    )
}

export default Login