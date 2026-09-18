import { useEffect, useState } from "react"
import { apiGet } from "../api"

function ProblemFeed() {
    const [error, setError] = useState("")
    const [problems, setProblems] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function loadProblems() {
            try {
                setError("")
                const data = await apiGet("/problems")
                setProblems(data)
            } catch (e) {
                setError(e.message || "Something went wrong")
            } finally {
                setLoading(false)
            }
        }
        loadProblems()
    }, [])

    // Three genuinely different states, told apart properly. Before, an empty
    // array meant both "still fetching" and "nothing posted", so the feed
    // flashed "No posted yet." on every single page load before the data landed.
    if (loading) {
        return <p>Loading problems...</p>
    }

    return (
        <div>
            <h1>Problem Feed</h1>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {!error && problems.length === 0 && <p>No problems posted yet.</p>}
            {problems.map((problem) => (
                <div key={problem.id}>
                    <h3>{problem.title}</h3>
                    <p>{problem.description}</p>
                    <p>{problem.category}</p>
                </div>
            ))}
        </div>
    )
}

export default ProblemFeed
