// Shared input styling for forms; a red border marks a field with a problem.
export function inputClass(hasError = false) {
    return (
        "w-full rounded-lg border px-3 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition " +
        "focus:ring-2 disabled:bg-slate-50 disabled:text-slate-400 " +
        (hasError
            ? "border-red-400 focus:border-red-500 focus:ring-red-500/30"
            : "border-slate-300 focus:border-brand-500 focus:ring-brand-500/30")
    )
}
