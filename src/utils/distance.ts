export interface Coords { lat: number; lon: number; }

// Haversine formula — returns distance in miles
export function haversine(a: Coords, b: Coords): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (b.lat - a.lat) * (Math.PI / 180);
  const dLon = (b.lon - a.lon) * (Math.PI / 180);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * (Math.PI / 180)) *
      Math.cos(b.lat * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

// Geocode a city string via our backend proxy (avoids CORS issues)
export async function geocodeCity(city: string): Promise<Coords | null> {
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(city)}`);
    return await res.json();
  } catch {
    return null;
  }
}

export function formatDistance(miles: number): string {
  if (miles < 1) return '< 1 mi';
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}
