import { Image, Canvas, ImageData } from "canvas";
import { embedFiles } from "./steganography.ts";

export async function bufferToImageData(buffer: Buffer): Promise<ImageData> {
  const image = new Image();

  await new Promise<void>((resolveLoad, reject) => {
    image.onload = () => resolveLoad();
    image.onerror = (err) => reject(err instanceof Error ? err : new Error(String(err)));
    image.src = buffer;
  });

  const canvas = new Canvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, image.width, image.height);

  return ctx.getImageData(0, 0, image.width, image.height);
}

interface fileEncodeSig {
  files: File[],
  imageFile: File,
  bitsPerChannel?: number
}

/*
File
├─ name: string          // "a.txt"
├─ size: number          // バイト数
├─ type: string          // MIMEタイプ "text/plain"（空文字のこともある）
├─ lastModified: number  // タイムスタンプ(ms)
└─ (中身のバイト列は非同期メソッドで取り出す)
     ├─ arrayBuffer(): Promise<ArrayBuffer>   // ← バイト列が欲しいならこれ
     ├─ text(): Promise<string>
     ├─ stream(): ReadableStream
     └─ bytes(): Promise<Uint8Array>          // 新しめの環境

ImageData
├─ width: number
├─ height: number
├─ colorSpace: "srgb" | "display-p3"
└─ data: Uint8ClampedArray   // ← 本体
      長さ = width × height × 4
      並び = [R,G,B,A, R,G,B,A, ...]  ピクセルを左上から右→下へ走査
      各要素 0–255
*/

export async function fileToImageData(input: fileEncodeSig): Promise<ImageData> {
  const imageBuffer = Buffer.from(await input.imageFile.arrayBuffer());
  const image = await bufferToImageData(imageBuffer);

  const result = await embedFiles({
    files: input.files,
    image,
    bitsPerChannel: input.bitsPerChannel,
  });

  return new ImageData(result.data, result.width, result.height);
}
