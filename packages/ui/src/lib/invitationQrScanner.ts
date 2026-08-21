import type { InvitationQrScannerSession } from './invitationQrScannerSupport.ts';
import { getInvitationQrScannerErrorMessage } from './invitationQrScannerSupport.ts';
import {
  attachVideoStream,
  createScanLoop,
  createSessionStopper,
} from './invitationQrScannerRuntime.ts';

export type { InvitationQrScannerSession } from './invitationQrScannerSupport.ts';
export {
  getInvitationQrScannerErrorMessage,
  isInvitationQrScanSupported,
  primeInvitationQrCameraAccess,
} from './invitationQrScannerSupport.ts';

type DetectedBarcode = {
  rawValue: string;
};

type BarcodeDetectorInstance = {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]>;
};

type BarcodeDetectorConstructor = {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance;
  getSupportedFormats?: () => Promise<string[]>;
};

function getBarcodeDetector(): BarcodeDetectorConstructor | undefined {
  return (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector;
}

async function supportsBarcodeDetectorQr(): Promise<boolean> {
  const BarcodeDetector = getBarcodeDetector();
  if (!BarcodeDetector) {
    return false;
  }

  try {
    if (typeof BarcodeDetector.getSupportedFormats === 'function') {
      const formats = await BarcodeDetector.getSupportedFormats();
      return formats.includes('qr_code');
    }
    return true;
  } catch {
    return false;
  }
}

async function startBarcodeDetectorScanner(options: {
  video: HTMLVideoElement;
  onDecoded: (text: string) => void;
}): Promise<InvitationQrScannerSession> {
  const BarcodeDetector = getBarcodeDetector();
  if (!BarcodeDetector) {
    throw new Error(getInvitationQrScannerErrorMessage());
  }

  const detector = new BarcodeDetector({ formats: ['qr_code'] });
  const stream = await attachVideoStream(options.video);
  let scanLoop: ReturnType<typeof createScanLoop> | null = null;

  const handleDecoded = (value: string) => {
    scanLoop?.stop();
    options.onDecoded(value);
  };

  scanLoop = createScanLoop(async () => {
    if (options.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    const barcodes = await detector.detect(options.video);
    const value = barcodes[0]?.rawValue?.trim();
    if (value) {
      handleDecoded(value);
    }
  });

  scanLoop.start();

  return createSessionStopper({
    scanLoop,
    video: options.video,
    stream,
  });
}

export async function startInvitationQrScanner(options: {
  video: HTMLVideoElement;
  onDecoded: (text: string) => void;
}): Promise<InvitationQrScannerSession> {
  if (await supportsBarcodeDetectorQr()) {
    return startBarcodeDetectorScanner(options);
  }

  const { startJsQrScanner } = await import('./invitationJsQrScanner.ts');
  return startJsQrScanner(options);
}
