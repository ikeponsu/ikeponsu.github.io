import { siteConfig } from "@/lib/site-config";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-sky-200 bg-sky-50">
      <div className="mx-auto max-w-3xl px-6 py-8 text-center text-sm text-sky-600">
        © {year} {siteConfig.author}
      </div>
    </footer>
  );
}
