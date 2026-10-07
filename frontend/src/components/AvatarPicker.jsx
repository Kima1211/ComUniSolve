import { useState } from "react"
import { apiPatch } from "../api"
import { useAuth } from "../auth-context"
import { useLanguage } from "../i18n/language-context"
import { AVATAR_COLORS, AVATAR_SPRITES } from "../pixel-avatars"
import { alertError, alertNote, btnPrimary, btnSecondary, panel, panelTitle } from "../ui"
import Avatar, { PixelAvatar } from "./Avatar"

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
                    ? <PixelAvatar icon={icon} color={color} size="xl" />
                    : <Avatar name={user.name} size="lg" />}
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
