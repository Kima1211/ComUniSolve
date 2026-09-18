import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api";

function PostProblem() {
    const navigate = useNavigate()

    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("")
    const [error, setError] = useState("")
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()

        try {
            setError("")
            setSubmitting(true)

            const data = await apiPost("/problems", {
                title: title,
                description: description,
                category: category,
            })
            console.log(data)
            navigate('/')
        } catch (e) {
            // By the time an ApiError with status 401 reaches here, api() has
            // already tried /refresh and failed - so the session really is over
            // and the only useful next step is to log in again.
            if (e.status === 401) {
                navigate('/login')
                return
            }
            setError(e.message || "Something went wrong! Please try again.")
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            <input
            type="text"
            placeholder="Title"
            value={title} onChange={(e) => setTitle(e.target.value)}
            />

            <textarea
            placeholder="Description"
            value={description} onChange={(e) => setDescription(e.target.value)}
            />

            <input
            type="text"
            placeholder="Category"
            value={category} onChange={(e) => setCategory(e.target.value)}
            />

            <button type="submit"
            className="submitProblem"
            disabled={submitting}>{submitting ? "Posting..." : "Submit Problem"}</button>
            {error && <p style={{ color: 'red', marginTop: '5px' }}>{error}</p>}
        </form>
    )
}

export default PostProblem
