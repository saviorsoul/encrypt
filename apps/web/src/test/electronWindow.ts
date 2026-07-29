export function clearWindowElectron(): void {
  Reflect.deleteProperty(window, 'electron');
}

/** Assign a partial Electron preload mock in tests. */
export function setWindowElectron(electron: object): void {
  window.electron = electron as NonNullable<Window['electron']>;
}
