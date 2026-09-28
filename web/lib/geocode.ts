export type Coordinates = { lat: number; lng: number };

/**
 * City-level coordinates from OpenStreetMap's Nominatim (P1): null when the
 * city isn't found. Called only when the user asks, as its usage policy
 * requires (at most one request a second).
 */
export async function findCoordinates(city: string, country: string): Promise<Coordinates | null> {
  const params = new URLSearchParams({
    city,
    countrycodes: country.toLowerCase(),
    format: "jsonv2",
    limit: "1",
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
  if (!res.ok) {
    throw new Error(`The location lookup failed (${res.status})`);
  }
  const [place] = (await res.json()) as { lat: string; lon: string }[];
  // Four decimals is about 10 m, plenty for a city.
  const round = (value: string) => Math.round(Number(value) * 1e4) / 1e4;
  return place ? { lat: round(place.lat), lng: round(place.lon) } : null;
}
