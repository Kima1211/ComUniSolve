import { Link } from "react-router-dom";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import Logo from "./Logo";

// Centred 400px panel on canvas, per DESIGN.md "Login and register" spec.
// No side preview, no illustration. Logo + language switch in a thin top bar.
function AuthLayout({ title, subtitle, children, footer }) {
    return (
        <div className="min-h-screen bg-page">
            <header className="brand-line h-14 border-b border-border bg-surface">
                <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-4">
                    <Link to="/" className="flex items-center gap-2">
                        <Logo size={28} />
                        <span className="text-lg font-semibold text-ink">ComUniSolve</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <LanguageSwitcher />
                    </div>
                </div>
            </header>

            <main className="flex items-start justify-center px-4 py-10 sm:py-16">
                <div className="w-full max-w-[400px] rounded-lg border border-border bg-surface p-6 sm:p-8">
                    <h1 className="text-[22px] font-semibold leading-[1.3] tracking-tight text-ink">{title}</h1>
                    {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}

                    <div className="mt-6">{children}</div>

                    {footer && <p className="mt-6 text-sm text-muted">{footer}</p>}
                </div>
            </main>
        </div>
    )
}

export default AuthLayout
