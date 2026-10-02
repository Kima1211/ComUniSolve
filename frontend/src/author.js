export function authorLabel(author, t) {
    if (!author) return t("common.unknown")
    return author.is_deleted ? t("common.deletedUser") : author.name
}

export function hasProfile(author) {
    return Boolean(author) && !author.is_deleted
}
