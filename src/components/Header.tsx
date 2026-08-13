import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export default function Header() {
  return (
    <header className="border-b border-sky-200 bg-white/70 backdrop-blur-sm sticky top-0 z-10">
      <div className="mx-auto max-w-3xl px-6 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="text-lg font-bold text-sky-800 tracking-tight hover:text-sky-600 transition-colors"
        >
          {siteConfig.title}
        </Link>
        <nav className="flex gap-5 text-sm font-medium text-sky-700">
          <Link href="/" className="hover:text-sky-500 transition-colors">
            記事一覧
          </Link>
          <Link href="/about" className="hover:text-sky-500 transition-colors">
            About
          </Link>
        </nav>
      </div>
    </header>
  );
}
