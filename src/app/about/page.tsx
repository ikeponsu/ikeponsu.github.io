import { siteConfig } from "@/lib/site-config";

export const metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-14">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">
        About
      </h1>
      <div className="prose-post mt-6">
        <p>
          {siteConfig.author} が運営するブログです。{siteConfig.description}
        </p>
        <p>
          このサイトは Next.js で作成し、GitHub Pages
          で公開しています。記事は Markdown ファイルとして管理しています。
        </p>
      </div>
    </div>
  );
}
