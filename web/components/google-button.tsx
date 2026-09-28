// A plain link: the whole OAuth round trip is a sequence of browser redirects.
export function GoogleButton() {
  return (
    <a
      href="/api/auth/google"
      className="block rounded-md border border-neutral-300 px-4 py-2 text-center text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
    >
      Continue with Google
    </a>
  );
}
