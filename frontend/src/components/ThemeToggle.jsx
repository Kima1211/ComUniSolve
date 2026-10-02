import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useLanguage } from "../i18n/language-context";
import { nextTheme, savedTheme, setTheme } from "../theme";

const ICONS = { system: Monitor, light: Sun, dark: Moon }

// One button that cycles System -> Light -> Dark. The icon shows the current CHOICE:
// a monitor means "following the phone". The label says what it is now and what a tap does.
function ThemeToggle() {
    const { t } = useLanguage()
    const [choice, setChoice] = useState(savedTheme)
    const Icon = ICONS[choice]
    const label = t("theme.label", { current: t(`theme.${choice}`), next: t(`theme.${nextTheme(choice)}`) })

    function cycle() {
        const next = nextTheme(choice)
        setTheme(next)
        setChoice(next)
    }

    return (
        <button
            type="button"
            onClick={cycle}
            aria-label={label}
            title={label}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border text-muted hover:bg-surface-2 hover:text-ink sm:h-8 sm:w-8"
        >
            <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
    )
}

export default ThemeToggle
