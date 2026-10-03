import { useNavigate } from "react-router-dom"

// Every Home click carries a new stamp, so the feed reloads even when you're already on Home.
export function useHomeClick() {
    const navigate = useNavigate()
    return (e) => {
        // Ctrl/Cmd/Shift/middle click keep the browser's open-in-new-tab behaviour.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        navigate("/", { state: { refresh: Date.now() } })
    }
}
