import { useState } from "react";
import { useNavigate } from "react-router-dom";

function PostProblem() {
    const navigate = useNavigate() 
    
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("")
    const [error, setError] = useState("")

    async function handleSubmit(){
        try{
            setError("")
            const response = await fetch("http://localhost:8000/problems", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                credentials: "include",
                body: JSON.stringify({title: title, description: description, category: category})
            })
            const data = await response.json()

            if(response.ok){
                console.log(data)
                navigate('/')
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
            type="text"
            placeholder="Title"
            value={title} onChange={(e) => setTitle(e.target.value)}
            />

            <input 
            type="text"
            placeholder="Description"
            value={description} onChange={(e) => setDescription(e.target.value)}
            />

            <input 
            type="text"
            placeholder="Category"
            value={category} onChange={(e) => setCategory(e.target.value)}
            />

             <button type="button" 
            className="submitProblem" 
            onClick={handleSubmit}>Submit Problem</button>
            {error && <p style={{ color: 'red', marginTop: '5px' }}>{error}</p>}  
        </div>
    )
}

export default PostProblem