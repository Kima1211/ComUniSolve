// Decorative: the visible name or the link's aria-label names the site.
function Logo({ size = 28 }) {
    const shared = { width: size, height: size, alt: "", "aria-hidden": "true" }
    return (
        <>
            <img src="/icons/logo-128.png" {...shared} className="logo-light shrink-0" />
            <img src="/icons/logo-dark-128.png" {...shared} className="logo-dark shrink-0" />
        </>
    )
}

export default Logo
