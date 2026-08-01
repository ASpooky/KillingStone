import type { RawImageData } from "../../src/core/steganography.ts";

export async function fileToRawImageData(file: File): Promise<RawImageData> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D contextを取得できませんでした");
  }
  ctx.drawImage(bitmap, 0, 0);

  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return { width: imageData.width, height: imageData.height, data: imageData.data };
}

export function rawImageDataToCanvas(image: RawImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D contextを取得できませんでした");
  }
  ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  return canvas;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolvePromise, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolvePromise(blob);
      } else {
        reject(new Error("PNGへの変換に失敗しました"));
      }
    }, "image/png");
  });
}
