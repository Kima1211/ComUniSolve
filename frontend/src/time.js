// "5m ago", "3h ago", "2d ago"; older than a week shows the date. Shared by the feed and the problem page.
export function timeAgo(iso, t) {
    if (!iso) return ""
    const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
    if (seconds < 60) return t("time.secondsAgo", { n: seconds })
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return t("time.minutesAgo", { n: minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t("time.hoursAgo", { n: hours })
    const days = Math.floor(hours / 24)
    if (days < 7) return t("time.daysAgo", { n: days })
    return new Date(iso).toLocaleDateString()
}
