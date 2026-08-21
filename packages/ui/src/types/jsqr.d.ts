declare module 'jsqr' {
  export type QrCode = {
    data: string;
  };

  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
  ): QrCode | null;
}
