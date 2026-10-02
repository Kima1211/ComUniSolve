export function inputClass(hasError = false) {
    return (
        "min-h-10 w-full rounded-md border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted " +
        "disabled:cursor-not-allowed disabled:opacity-60 " +
        (hasError ? "border-error" : "border-border")
    )
}
