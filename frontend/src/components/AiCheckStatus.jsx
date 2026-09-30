// Shown while the backend waits on the AI clarity/safety check, so the few-second wait feels intentional.
function AiCheckStatus({ message = "Checking your post with AI for clarity and safety. This takes a few seconds..." }) {
    return (
        <p
            role="status"
            className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm text-purple-800"
        >
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-purple-500" />
            {message}
        </p>
    )
}

export default AiCheckStatus
