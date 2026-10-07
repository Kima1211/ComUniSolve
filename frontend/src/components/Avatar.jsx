import { useId } from "react";
import { avatarClass, colorFor, initialsFor } from "../avatar";
import { AVATAR_COLORS, hasPixelAvatar, spritePixels } from "../pixel-avatars";
import { frameMarkup } from "../avatar-frames";

const SIZES = { xs: "h-5 w-5", sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14", xl: "h-20 w-20" }

// The view box leaves room above the head and lets the shoulders run off the bottom of the circle.
export function PixelAvatar({ icon, color, size = "md" }) {
    const pixels = spritePixels(icon) || []
    return (
        <svg
            viewBox="-1.33 -3 18.67 18.67"
            className={`${SIZES[size]} shrink-0 overflow-hidden rounded-full`}
            aria-hidden="true"
        >
            <rect x="-1.33" y="-3" width="18.67" height="18.67" fill={AVATAR_COLORS[color]} />
            <g shapeRendering="crispEdges">
                {pixels.map((p) => (
                    <rect key={`${p.x}-${p.y}`} x={p.x} y={p.y} width="1.02" height="1.02" fill={p.fill} />
                ))}
            </g>
        </svg>
    )
}

export function AvatarFrame({ frame, size = "md", children }) {
    // Gradient ids must be unique on the page, and only letters and digits are safe inside url(#...).
    const id = "f" + useId().replace(/[^a-zA-Z0-9]/g, "")
    if (!frame) return children
    return (
        <span className={`relative inline-grid shrink-0 place-items-center ${SIZES[size]}`}>
            {children}
            <svg
                viewBox="0 0 100 100"
                aria-hidden="true"
                className={`avatar-frame avatar-frame--${frame}`}
                dangerouslySetInnerHTML={{ __html: frameMarkup(frame, id) }}
            />
        </span>
    )
}

// `frame` overrides the person's own frame (the picker uses it to preview choices).
function Avatar({ name, person, size = "md", frame }) {
    const shown = frame !== undefined ? frame : person?.shown_frame
    const face = hasPixelAvatar(person)
        ? <PixelAvatar icon={person.avatar_icon} color={person.avatar_color} size={size} />
        : (
            <span className={avatarClass(colorFor(name), size)} aria-hidden="true">
                {initialsFor(name)}
            </span>
        )
    return <AvatarFrame frame={shown} size={size}>{face}</AvatarFrame>
}

export default Avatar
