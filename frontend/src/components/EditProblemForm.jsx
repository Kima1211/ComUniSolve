import { useState } from "react";
import { apiPatch } from "../api";
import { CATEGORIES } from "../categories";
import ModerationNotice from "./ModerationNotice";

const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none " +
    "focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-50"

function EditProblemForm({ problem, onSaved, onCancel }) {
    const [title, setTitle] = useState(problem.title)
    const [description, setDescription] = useState(problem.description || "")
    const [category, setCategory] = useState(problem.category)

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [gate, setGate] = useState(null)

    async function save(acknowledged) {
        try {
            setError("")
            setGate(null)
            setSaving(true)
            const updated = await apiPatch(`/problems/${problem.id}`, { title, description, category, acknowledged })
            onSaved(updated)
        } catch (e) {
            // Edits pass through the same moderation gate as new posts.
            if (e.status === 422 && e.detail?.verdict) {
                setGate(e.detail)
                return
            }
            setError(e.message || "Could not save your changes")
        } finally {
            setSaving(false)
        }
    }

    function handleSubmit(e) {
        e.preventDefault()
        save(false)
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label htmlFor="edit-title" className="mb-1 block text-sm font-medium text-slate-700">Title</label>
                <input
                    id="edit-title" className={inputClass} disabled={saving} maxLength={255}
                    value={title} onChange={(e) => setTitle(e.target.value)}
                />
            </div>
            <div>
                <label htmlFor="edit-category" className="mb-1 block text-sm font-medium text-slate-700">Category</label>
                <select
                    id="edit-category" className={inputClass} disabled={saving}
                    value={category} onChange={(e) => setCategory(e.target.value)}
                >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            <div>
                <label htmlFor="edit-description" className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                    id="edit-description" rows={5} className={inputClass} disabled={saving} maxLength={5000}
                    value={description} onChange={(e) => setDescription(e.target.value)}
                />
            </div>

            {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            {gate && (
                <ModerationNotice
                    gate={gate}
                    busy={saving}
                    onUseSuggestion={(s) => { setDescription(s); setGate(null) }}
                    onPostAnyway={() => save(true)}
                />
            )}

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={saving || !title.trim()}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white
                               hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                    {saving ? "Saving..." : "Save changes"}
                </button>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={saving}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                    Cancel
                </button>
            </div>
        </form>
    )
}

export default EditProblemForm
