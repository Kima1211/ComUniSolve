import { avatarClass, colorFor, initialsFor } from "../avatar";

// Round "profile picture" built from the author's initials, with a stable colour per name.
// We deliberately don't upload avatar images (image moderation isn't built yet).
function Avatar({ name, size = "md" }) {
    return (
        <span className={avatarClass(colorFor(name), size)} aria-hidden="true">
            {initialsFor(name)}
        </span>
    )
}

export default Avatar
