import { createContext, useContext } from "react";

// confirm(options) opens the confirmation dialog and resolves to null (cancelled)
// or { reason } (confirmed; reason is "" when the dialog has no reason box).
// See components/ConfirmDialog.jsx for the options.
export const ConfirmContext = createContext(null);

export function useConfirm() {
    const confirm = useContext(ConfirmContext);
    if (confirm === null) {
        throw new Error("useConfirm must be used inside <ConfirmProvider>");
    }
    return confirm;
}
