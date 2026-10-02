import { avatarClass, colorFor, initialsFor } from "../avatar";

function Avatar({ name, size = "md" }) {
    return (
        <span className={avatarClass(colorFor(name), size)} aria-hidden="true">
            {initialsFor(name)}
        </span>
    )
}

export default Avatar
