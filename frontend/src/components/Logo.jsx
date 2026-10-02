// The ComUniSolve mark: two speech bubbles forming a C and an S, recoloured from
// public/icons/Comunisolve.png into small 128px files (the 2156px original would slow every page).
// Two colourings: charcoal + amber for light mode, light grey + amber for dark mode. index.css
// (.logo-light / .logo-dark) shows only the one that matches the current mode.
// Decorative here: the "ComUniSolve" text or the link's aria-label carries the name.
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
