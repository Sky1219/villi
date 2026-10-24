import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 pt-20 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link href="/" className="flex min-h-12 items-center rounded-xl bg-accent px-5 font-bold text-accent-ink">
        Go home
      </Link>
    </main>
  );
}
