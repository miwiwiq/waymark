/** A stable colour per user, for avatars and trail markers. */
export function userColor(userId: string): string {
  let hash = 0;
  for (const char of userId) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return `hsl(${Math.abs(hash) % 360} 55% 42%)`;
}

/** "ana.travels" → "AT", "lisbonlover" → "LI". */
export function initials(username: string): string {
  const parts = username.split(/[._]+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : username.slice(0, 2)).toUpperCase();
}
