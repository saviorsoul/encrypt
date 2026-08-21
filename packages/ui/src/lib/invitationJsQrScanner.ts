import type { InvitationQrScannerSession } from './invitationQrScannerSupport.ts';
import { getInvitationQrScannerErrorMessage } from './invitationQrScannerSupport.ts';
import {
  attachVideoStream,
  createScanLoop,
  createSessionStopper,
} from './invitationQrScannerRuntime.ts';

type JsQrDecoder = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => { data: string } | null;

let jsQrModulePromise: Promise<JsQrDecoder> | null = null;

function loadJsQrDecoder(): Promise<JsQrDecoder> {
  jsQrModulePromise ??= import('jsqr').then((module) => module.default);
  return jsQrModulePromise;
}

export async function startJsQrScanner(options: {
  video: HTMLVideoElement;
  onDecoded: (text: string) => void;
}): Promise<InvitationQrScannerSession> {
  const jsQR = await loadJsQrDecoder();
  const stream = await attachVideoStream(options.video);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    for (const track of stream.getTracks()) {
      track.stop();
    }
    throw new Error(getInvitationQrScannerErrorMessage());
  }

  let lastWidth = 0;
  let lastHeight = 0;
  let scanLoop: ReturnType<typeof createScanLoop> | null = null;

  const handleDecoded = (value: string) => {
    scanLoop?.stop();
    options.onDecoded(value);
  };

  scanLoop = createScanLoop(() => {
    if (options.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      return;
    }

    const width = options.video.videoWidth;
    const height = options.video.videoHeight;
    if (width === 0 || height === 0) {
      return;
    }

    if (width !== lastWidth || height !== lastHeight) {
      canvas.width = width;
      canvas.height = height;
      lastWidth = width;
      lastHeight = height;
    }

    context.drawImage(options.video, 0, 0, width, height);

    const imageData = context.getImageData(0, 0, width, height);
    const result = jsQR(imageData.data, imageData.width, imageData.height);
    const value = result?.data?.trim();
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
