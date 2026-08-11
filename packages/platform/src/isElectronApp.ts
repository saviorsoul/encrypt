export function isElectronApp(): boolean {
  return (
    Boolean((window as Window & { electron?: unknown }).electron) ||
    Boolean(import.meta.env.VITE_ELECTRON)
  );
}
