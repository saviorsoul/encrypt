export function isCapacitorApp(): boolean {
  return Boolean(import.meta.env.VITE_CAPACITOR);
}
