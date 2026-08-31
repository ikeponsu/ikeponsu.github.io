import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-foreground transition-opacity hover:opacity-70"
        >
          {siteConfig.title}
        </Link>
        <nav className="flex gap-6 text-sm text-muted">
          <Link href="/" className="transition-colors hover:text-foreground">
            記事一覧
          </Link>
          <Link
            href="/about"
            className="transition-colors hover:text-foreground"
          >
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
