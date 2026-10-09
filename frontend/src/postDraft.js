const DRAFT_KEY = "comunisolve-post-draft"

// sessionStorage can throw (private mode, blocked storage), so the form must work without it.
export function loadDraft(search) {
    try {
        const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY)) || {}
        // Only a new, different search starts fresh; arriving without one keeps the draft.
        return !search || draft.search === search ? draft : {}
    } catch {
        return {}
    }
}

export function saveDraft(draft) {
    try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
        // The form still works, the draft just won't survive leaving the page.
    }
}

export function clearDraft() {
    try {
        sessionStorage.removeItem(DRAFT_KEY)
    } catch {
        // Nothing was saved.
    }
}
