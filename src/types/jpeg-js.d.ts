declare module 'jpeg-js' {
  export interface DecodeOptions {
    useTArray?: boolean;
    colorTransform?: boolean;
    formatAsRGBA?: boolean;
    tolerantDecoding?: boolean;
    maxResolutionInMP?: number;
    maxMemoryUsageInMB?: number;
  }

  export interface DecodedJpeg {
    width: number;
    height: number;
    data: Uint8Array;
  }

  export function decode(
    jpegData: ArrayBufferView | ArrayBuffer,
    opts?: DecodeOptions
  ): DecodedJpeg;
}
