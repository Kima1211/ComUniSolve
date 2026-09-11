import { useEffect } from "react"
import { useState } from "react"

function ProblemFeed() {
    const [error, setError] = useState("")
    const [problems, setProblems] = useState([])

    useEffect(()=> {
        async function loadProblems() {
            try{
            setError("")
                const response = await fetch("http://localhost:8000/problems")
                const data = await response.json()
                if(response.ok){
                    setProblems(data)
                } else {
                    setError(data.detail)
                }
            } catch(e){
                setError(e.message || "Something went wrong")
            }
        } loadProblems()
        }, [])

    return (
        <div>
            <h1>Problem Feed</h1>
            {error && <p>{error}</p>}
            {problems.map((problem)=>(
                <div key={problem.id}>
                    {problems.length === 0 && <p>No posted yet.</p>}
                    <h3>{problem.title}</h3>
                    <p>{problem.description}</p>
                    <p>{problem.category}</p>
                </div>
            ))}
        </div>
    
    )
}

export default ProblemFeed
