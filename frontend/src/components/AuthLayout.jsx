import { Link } from "react-router-dom";
import CommunityPreview from "./CommunityPreview";

/**
 * Split-screen shell shared by Login and Register: the form on the left, a
 * live snippet of the community feed on the right.
 *
 * On a phone the right panel is hidden entirely and the form fills the screen -
 * see CommunityPreview. That is the whole responsive strategy for these pages.
 */
function AuthLayout({ title, subtitle, children, footer }) {
    return (
        // One column by default, two equal columns from lg up. min-h-screen on
        // the grid makes both panels full height regardless of which is taller.
        <div className="min-h-screen grid lg:grid-cols-2">

            {/* Left: the form */}
            <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
                <div className="mx-auto w-full max-w-sm">

                    <Link to="/" className="inline-flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
                            C
                        </span>
                        <span className="text-lg font-bold tracking-tight text-slate-900">
                            ComUniSolve
                        </span>
                    </Link>

                    <h1 className="mt-10 text-2xl font-bold tracking-tight text-slate-900">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
                    )}

                    <div className="mt-8">{children}</div>

                    {footer && (
                        <p className="mt-8 text-sm text-slate-600">{footer}</p>
                    )}
                </div>
            </div>

            {/* Right: what the visitor is signing up for */}
            <CommunityPreview />
        </div>
    )
}

export default AuthLayout
