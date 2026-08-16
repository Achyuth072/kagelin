// Routes whose own redirect swallows the bounce before "/" ever renders.
export const AUTH_STANDALONE_ROUTES: readonly string[] = [
  "/login",
  "/signup",
  "/auth/update-password",
];
