export function nameInitial(name: string): string {
  const trimmed = name.trim();
  return (trimmed.charAt(0) || '?').toUpperCase();
}
