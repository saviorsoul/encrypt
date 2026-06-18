import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  isManifestStepMounted,
  subscribeManifestStepMount,
} from '@/components/manifest-steps/manifestStepRegistry.ts';

function scrollToManifestStep(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Scroll to `#encrypt-step-N` / `#decrypt-step-N` when the URL hash changes. */
export function useManifestStepHashScroll() {
  const location = useLocation();

  useEffect(() => {
    const id = location.hash.replace(/^#/, '');
    if (!id) return;

    const scrollWhenReady = () => {
      if (!isManifestStepMounted(id) && !document.getElementById(id)) {
        return false;
      }
      scrollToManifestStep(id);
      return true;
    };

    if (scrollWhenReady()) return;

    return subscribeManifestStepMount((mountedId) => {
      if (mountedId === id) scrollWhenReady();
    });
  }, [location.hash, location.pathname]);
}
