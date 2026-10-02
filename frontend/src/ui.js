// Shared looks from DESIGN.md, so every page builds buttons, panels and alerts the same way.
// They're just class strings: use them as className={btnPrimary}, or add to them with a template string.
// Heights: 40px buttons (h-10), which also keeps phone tap targets near the 44px guideline.

// Buttons. One primary per screen; secondary = border + amber text; ghost = text only.
export const btnPrimary =
    "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold " +
    "text-on-primary hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 shine"
export const btnSecondary =
    "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface px-4 " +
    "text-sm font-semibold text-link hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
export const btnGhost =
    "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium text-muted " +
    "hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
// For actions that remove or end something (delete, deactivate, remove a post).
export const btnDanger =
    "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-surface px-4 " +
    "text-sm font-semibold text-error hover:bg-error-soft disabled:cursor-not-allowed disabled:opacity-50"
// The final "yes, delete it" button inside the confirmation dialog: filled red.
export const btnDangerSolid =
    "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-error px-4 text-sm font-semibold " +
    "text-on-error hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
// Smaller versions for dense rows (admin tables, comment actions).
export const btnSmall = "h-8 px-3 text-[13px]"

// Panels: Surface, 1px border, 12px corners. No shadow (DESIGN.md keeps shadows for floating layers).
export const panel = "rounded-lg border border-border bg-surface p-4 sm:p-6"
export const panelTitle = "text-base font-semibold text-ink"

// Page title (headline-md, 22px) and the muted line under it.
export const pageTitle = "text-[22px] font-semibold leading-[1.3] text-ink"
export const pageSub = "mt-1 text-sm text-muted"

// Messages inside forms and panels.
export const alertError = "rounded-md bg-error-soft px-3 py-2 text-sm text-error"
export const alertNote = "rounded-md bg-surface-2 px-3 py-2 text-sm text-ink"

// Status chips and tags: 4px corners.
export const chip = "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[12px] font-medium"

// Inline text links (e.g. "Create an account").
export const link = "font-medium text-link underline underline-offset-2 hover:text-link-hover"
