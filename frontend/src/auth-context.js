import { createContext, useContext } from "react";

// A Context is React's way of letting many components read the same value
// without passing it down through every layer in between. Without it, "who is
// logged in?" would have to be handed from App -> Home -> AuthPanel by hand,
// and again down every other branch that needs it.
export const AuthContext = createContext(null);

// A custom hook, so components write useAuth() instead of
// useContext(AuthContext) and importing the context object everywhere.
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}

// This lives apart from AuthProvider on purpose: Vite's Fast Refresh only
// works when a file exports components alone, so the component goes in
// auth.jsx and the plain values stay here.
