import type { InvitationQrScannerSession } from './invitationQrScannerSupport.ts';
import { getInvitationQrScannerErrorMessage } from './invitationQrScannerSupport.ts';

const SCAN_INTERVAL_MS = 100;

export async function openCameraStream(): Promise<MediaStream> {
  const configs: MediaTrackConstraints[] = [
    { facingMode: { ideal: 'environment' } },
    { facingMode: 'user' },
  ];

  let lastError: unknown;
  for (const video of configs) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video });
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(getInvitationQrScannerErrorMessage());
}

export async function attachVideoStream(
  video: HTMLVideoElement,
): Promise<MediaStream> {
  const stream = await openCameraStream();
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  await video.play();
  return stream;
}

export function createScanLoop(onTick: () => void | Promise<void>): {
  start: () => void;
  stop: () => void;
} {
  let stopped = false;
  let frameHandle = 0;
  let lastScanAt = 0;
  let ticking = false;

  const schedule = () => {
    if (stopped || ticking) {
      return;
    }
    frameHandle = requestAnimationFrame(() => {
      void tick();
    });
  };

  const tick = async () => {
    if (stopped || ticking) {
      return;
    }

    const now = performance.now();
    if (now - lastScanAt < SCAN_INTERVAL_MS) {
      schedule();
      return;
    }
    lastScanAt = now;
    ticking = true;

    try {
      await onTick();
    } catch {
      /* ignore per-frame detection errors */
    } finally {
      ticking = false;
      if (!stopped) {
        schedule();
      }
    }
  };

  return {
    start: schedule,
    stop: () => {
      stopped = true;
      ticking = false;
      cancelAnimationFrame(frameHandle);
    },
  };
}

export function createSessionStopper(options: {
  scanLoop: ReturnType<typeof createScanLoop>;
  video: HTMLVideoElement;
  stream: MediaStream;
}): InvitationQrScannerSession {
  let stopped = false;

  return {
    stop: async () => {
      if (stopped) {
        return;
      }
      stopped = true;

      options.scanLoop.stop();
      options.video.pause();
      options.video.srcObject = null;
      for (const track of options.stream.getTracks()) {
        track.stop();
      }
    },
  };
}
