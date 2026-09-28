function Stars({ value, className = "" }) {
    return (
        <span className={`tracking-tight ${className}`} aria-label={`${value} out of 5 stars`} title={`${value} out of 5 stars`}>
            <span className="text-amber-500">{"★".repeat(value)}</span>
            <span className="text-slate-300">{"★".repeat(5 - value)}</span>
        </span>
    )
}

export default Stars
