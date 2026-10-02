// Who wrote a post, as shown on screen. A deleted account (author.is_deleted) shows a translated
// "Deleted user" and has no profile to link to; its posts stay so others can still use the answers.
export function authorLabel(author, t) {
    if (!author) return t("common.unknown")
    return author.is_deleted ? t("common.deletedUser") : author.name
}

export function hasProfile(author) {
    return Boolean(author) && !author.is_deleted
}
