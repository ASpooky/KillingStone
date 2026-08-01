import { readFile } from "node:fs/promises";
import { Image, Canvas } from "canvas";


// Canvasで画像をピクセルデータに変換　(ImageData:https://developer.mozilla.org/ja/docs/Web/API/ImageData)
export async function imageToPixel(path: string) {
  const file = await readFile(path);

  const image = new Image();
  image.src = file;

  const canvas = new Canvas(image.width, image.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, image.width, image.height);

  return ctx.getImageData(0, 0, image.width, image.height);
}