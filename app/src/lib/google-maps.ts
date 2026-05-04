// Build Google Maps URL — single search ou multi-stop directions.

export function buildRouteUrl(addresses: string[]): string {
  if (addresses.length === 0) return '';
  if (addresses.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addresses[0])}`;
  }
  const [origin, ...rest] = addresses;
  const destination = rest.pop()!;
  const waypoints = rest.map((a) => encodeURIComponent(a)).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${
    waypoints ? `&waypoints=${waypoints}` : ''
  }`;
}

export function formatAddressForMaps(address: string, city: string, state: string): string {
  return `${address}, ${city}, ${state}`;
}
