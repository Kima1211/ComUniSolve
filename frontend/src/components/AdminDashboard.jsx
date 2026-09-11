import { useEffect } from "react";
import { useState } from "react";

function AdminDashboard() {
    const [error, setError] = useState("")
    const [total, setTotal] = useState({ total_users: 0, total_problems: 0, total_solutions: 0 })



    useEffect(() => {
        async function loadOverview() {
            try{
                setError("")
                    const response = await fetch("http://localhost:8000/admin/overview", { 
                        credentials: "include"
                    })
                       const data = await response.json()
                       if (response.ok){
                        setTotal(data)
                       } else {
                        setError(data.detail)
                       }
            } catch(e){
                setError(e.message || "Something went wrong! Please try again.")
            }
        } loadOverview()
    }, [])

        return (
            <div>
                 {error && <p>{error}</p>}
                <p>Total Users: {total.total_users}</p>
                <p>Total Problem: {total.total_problems}</p>
                <p>Total Solutions: {total.total_solutions}</p>
            </div>
        )
    }


export default AdminDashboard