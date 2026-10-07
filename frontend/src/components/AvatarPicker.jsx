import { useState } from "react"
import { apiPatch } from "../api"
import { useAuth } from "../auth-context"
import { useLanguage } from "../i18n/language-context"
import { AVATAR_COLORS, AVATAR_SPRITES } from "../pixel-avatars"
import { FRAMES, frameUnlocked, titleFrame } from "../avatar-frames"
import { alertError, alertNote, btnPrimary, btnSecondary, panel, panelTitle } from "../ui"
import Avatar, { AvatarFrame, PixelAvatar } from "./Avatar"

// Frames follow the user's title. Picking one saves straight away; no Save button needed.
function FramePicker() {
    const { user, refreshUser } = useAuth()
    const { t, label, errorText } = useLanguage()
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState(null)
    const [saved, setSaved] = useState(false)
    const choice = user.avatar_frame || "auto"
    const points = user.points ?? 0

    async function pick(frame) {
        if (frame === choice) return
        try {
            setBusy(true)
            setError(null)
            setSaved(false)
            await apiPatch("/users/me/frame", { frame })
            await refreshUser()
            setSaved(true)
        } catch (e) {
            setError(e)
        } finally {
            setBusy(false)
        }
    }

    const options = [
        { key: "auto", frame: titleFrame(points), name: t("frame.auto"), hint: t("frame.autoHint") },
        ...FRAMES.map((f) => ({ key: f.key, frame: f.key, name: t(`frame.${f.key}`), min: f.min, tier: f.tier })),
        { key: "none", frame: null, name: t("frame.none") },
    ]

    return (
        <div className="mt-6 border-t border-border pt-5">
            <p className="text-sm font-medium text-ink">{t("frame.title")}</p>
            <p className="mt-1 text-sm text-muted">{t("frame.body")}</p>
            <div role="radiogroup" aria-label={t("frame.title")} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {options.map((o) => {
                    const locked = o.min !== undefined && !frameUnlocked(o.key, points)
                    const on = choice === o.key
                    return (
                        <button
                            key={o.key}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            disabled={busy || locked}
                            onClick={() => pick(o.key)}
                            className={`flex flex-col items-center gap-2 rounded-lg border px-2 pb-3 pt-5 text-center ${
                                on ? "border-primary bg-primary-soft" : "border-border hover:bg-surface-2"
                            } disabled:cursor-not-allowed`}
                        >
                            <span className={locked ? "opacity-40 grayscale" : ""}>
                                <Avatar name={user.name} person={user} size="lg" frame={o.frame} />
                            </span>
                            <span className="text-sm font-semibold text-ink">{o.name}</span>
                            {locked ? (
                                <>
                                    <span className="text-xs text-muted">
                                        {t("frame.locked", { tier: label("tier", o.tier), points, min: o.min })}
                                    </span>
                                    <span className="h-1 w-4/5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                                        <span className="block h-full bg-primary" style={{ width: `${Math.round((points / o.min) * 100)}%` }} />
                                    </span>
                                </>
                            ) : (
                                <span className="text-xs text-muted">{on ? t("frame.selected") : o.hint || t("frame.unlocked")}</span>
                            )}
                        </button>
                    )
                })}
            </div>
            {error && <p role="alert" className={`${alertError} mt-4`}>{errorText(error)}</p>}
            {saved && <p role="status" className={`${alertNote} mt-4`}>{t("frame.saved")}</p>}
        </div>
    )
}

function AvatarPicker() {
    const { user, refreshUser } = useAuth()
    const { t, label, errorText } = useLanguage()
    const [icon, setIcon] = useState(user.avatar_icon || null)
    const [color, setColor] = useState(user.avatar_color || "teal")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [saved, setSaved] = useState(false)

    const changed = icon !== (user.avatar_icon || null) || (icon !== null && color !== user.avatar_color)

    async function save(nextIcon) {
        try {
            setSaving(true)
            setError(null)
            await apiPatch("/users/me/avatar", { icon: nextIcon, color: nextIcon ? color : null })
            await refreshUser()
            setIcon(nextIcon)
            setSaved(true)
        } catch (e) {
            setError(e)
        } finally {
            setSaving(false)
        }
    }

    function pick(update) {
        update()
        setSaved(false)
    }

    const choice = (selected) => selected ? "bg-primary-soft ring-2 ring-primary" : "hover:bg-surface-2"

    return (
        <section className={`${panel} mt-4`}>
            <h2 className={panelTitle}>{t("avatar.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("avatar.body")}</p>

            <div className="mt-4 flex items-center gap-4">
                {icon
                    ? <AvatarFrame frame={user.shown_frame} size="xl"><PixelAvatar icon={icon} color={color} size="xl" /></AvatarFrame>
                    : <Avatar name={user.name} size="lg" frame={user.shown_frame} />}
                <p className="text-sm font-medium text-ink">
                    {icon ? label("category", AVATAR_SPRITES[icon].category) : t("avatar.initials")}
                </p>
            </div>

            <p className="mt-5 text-sm font-medium text-ink">{t("avatar.character")}</p>
            <div role="radiogroup" aria-label={t("avatar.character")} className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {Object.entries(AVATAR_SPRITES).map(([key, sprite]) => (
                    <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={icon === key}
                        aria-label={label("category", sprite.category)}
                        title={label("category", sprite.category)}
                        disabled={saving}
                        onClick={() => pick(() => setIcon(key))}
                        className={`flex justify-center rounded-lg p-1.5 ${choice(icon === key)}`}
                    >
                        <PixelAvatar icon={key} color={color} size="md" />
                    </button>
                ))}
            </div>

            <p className="mt-5 text-sm font-medium text-ink">{t("avatar.colour")}</p>
            <div role="radiogroup" aria-label={t("avatar.colour")} className="mt-2 flex flex-wrap gap-2">
                {Object.entries(AVATAR_COLORS).map(([key, hex]) => (
                    <button
                        key={key}
                        type="button"
                        role="radio"
                        aria-checked={color === key}
                        aria-label={t(`avatar.color.${key}`)}
                        title={t(`avatar.color.${key}`)}
                        disabled={saving}
                        onClick={() => pick(() => setColor(key))}
                        className={`h-9 w-9 rounded-full p-1 ${choice(color === key)}`}
                    >
                        <span className="block h-full w-full rounded-full" style={{ background: hex }} />
                    </button>
                ))}
            </div>

            {error && <p role="alert" className={`${alertError} mt-4`}>{errorText(error)}</p>}
            {saved && !changed && <p role="status" className={`${alertNote} mt-4`}>{t("avatar.saved")}</p>}

            <FramePicker />

            <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                {user.avatar_icon && (
                    <button type="button" onClick={() => save(null)} disabled={saving} className={btnSecondary}>
                        {t("avatar.useInitials")}
                    </button>
                )}
                <button type="button" onClick={() => save(icon)} disabled={saving || !icon || !changed} className={btnPrimary}>
                    {saving ? t("reset.saving") : t("avatar.save")}
                </button>
            </div>
        </section>
    )
}

export default AvatarPicker
