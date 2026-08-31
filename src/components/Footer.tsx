import { siteConfig } from "@/lib/site-config";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-2xl px-6 py-10 text-center text-sm text-muted">
        © {year} {siteConfig.author}
      </div>
    </footer>
  );
}
