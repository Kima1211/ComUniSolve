import { useState } from "react";
import { apiPatch } from "../api";
import { useLanguage } from "../i18n/language-context";
import { inputClass } from "../form";
import { alertError, btnGhost, btnSecondary } from "../ui";
import CategoryOptions from "./CategoryOptions";
import ModerationNotice from "./ModerationNotice";
import AiCheckStatus from "./AiCheckStatus";

function EditProblemForm({ problem, onSaved, onCancel }) {
    const { t, errorText } = useLanguage()
    const [title, setTitle] = useState(problem.title)
    const [description, setDescription] = useState(problem.description || "")
    const [category, setCategory] = useState(problem.category)

    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [gate, setGate] = useState(null)

    async function save(acknowledged) {
        try {
            setError(null)
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
            setError(e)
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
                <label htmlFor="edit-title" className="mb-1 block text-sm font-medium text-ink">{t("post.titleLabel")}</label>
                <input
                    id="edit-title" className={inputClass()} disabled={saving} maxLength={255}
                    value={title} onChange={(e) => setTitle(e.target.value)}
                />
            </div>
            <div>
                <label htmlFor="edit-category" className="mb-1 block text-sm font-medium text-ink">{t("post.category")}</label>
                <select
                    id="edit-category" className={inputClass()} disabled={saving} required
                    value={category} onChange={(e) => setCategory(e.target.value)}
                >
                    <CategoryOptions />
                </select>
            </div>
            <div>
                <label htmlFor="edit-description" className="mb-1 block text-sm font-medium text-ink">{t("post.description")}</label>
                <textarea
                    id="edit-description" rows={5} className={inputClass()} disabled={saving} maxLength={5000}
                    value={description} onChange={(e) => setDescription(e.target.value)}
                />
            </div>

            {error && (
                <p role="alert" className={alertError}>
                    {errorText(error, "edit.couldNotSave")}
                </p>
            )}
            {gate && (
                <ModerationNotice
                    gate={gate}
                    busy={saving}
                    onUseSuggestion={(s) => { setDescription(s); setGate(null) }}
                    onPostAnyway={() => save(true)}
                />
            )}

            {saving && <AiCheckStatus message={t("aiCheck.edit")} />}

            {/* Outlined Save: "Post solution" stays the one filled button on the problem page. */}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel} disabled={saving} className={btnGhost}>
                    {t("common.cancel")}
                </button>
                <button type="submit" disabled={saving || !title.trim()} className={btnSecondary}>
                    {saving ? t("common.checking") : t("common.saveChanges")}
                </button>
            </div>
        </form>
    )
}

export default EditProblemForm
