import { createContext, useContext } from "react";

// confirm(options) resolves to null (cancelled) or { reason }. Options: see ConfirmDialog.jsx.
export const ConfirmContext = createContext(null);

export function useConfirm() {
    const confirm = useContext(ConfirmContext);
    if (confirm === null) {
        throw new Error("useConfirm must be used inside <ConfirmProvider>");
    }
    return confirm;
}
