const GITHUB_PROFILE_URL = "https://github.com/duckielover58";

export function SiteCredit() {
  return (
    <div className="fixed bottom-3 left-3 z-40">
      <a
        href={GITHUB_PROFILE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        @duckielover58
      </a>
    </div>
  );
}
