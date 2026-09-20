type MountListener = (id: string) => void;

const mountedStepIds = new Set<string>();
const mountListeners = new Set<MountListener>();

export function registerManifestStep(id: string): () => void {
  mountedStepIds.add(id);
  for (const listener of mountListeners) {
    listener(id);
  }
  return () => {
    mountedStepIds.delete(id);
  };
}

export function isManifestStepMounted(id: string): boolean {
  return mountedStepIds.has(id);
}

export function subscribeManifestStepMount(
  listener: MountListener,
): () => void {
  mountListeners.add(listener);
  return () => {
    mountListeners.delete(listener);
  };
}
