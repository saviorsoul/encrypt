export function isElectronApp(): boolean {
  return Boolean(window.electron) || Boolean(import.meta.env.VITE_ELECTRON);
}
