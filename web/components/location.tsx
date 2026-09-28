import { countryFlag, countryName } from "@/lib/countries";
import { formatCoordinates, type Post } from "@/lib/posts";

/** "🇵🇹 Lisbon, Portugal", plus the coordinates in mono when the post has them. */
export function Location({ location, className = "" }: { location: Post["location"]; className?: string }) {
  const flag = countryFlag(location.country);
  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/5 px-2 py-0.5 dark:bg-white/10">
        {flag && <span aria-hidden>{flag}</span>}
        {location.city}, {countryName(location.country)}
      </span>
      {location.lat !== undefined && location.lng !== undefined && (
        <span className="font-mono text-xs opacity-60">{formatCoordinates(location.lat, location.lng)}</span>
      )}
    </span>
  );
}
