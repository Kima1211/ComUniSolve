import { Link } from "react-router-dom";
import CommunityPreview from "./CommunityPreview";

function AuthLayout({ title, subtitle, children, footer }) {
    return (
        <div className="min-h-screen grid lg:grid-cols-2">

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

            <CommunityPreview />
        </div>
    )
}

export default AuthLayout
