// ベンチマーク用の合成フィクスチャを生成する。
// キャリア画像は自前で描画した画像なのでライセンス上の懸念なくpublicにコミットできる。
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { Canvas } from "canvas";
import { PNG } from "pngjs";

const OUTPUT_DIR = "./public/bench";
const IMAGE_SIZE = 1600; // bitsPerChannel=1でも1MBのpayloadが収まる大きさ

const PAYLOAD_SIZES: Record<string, number> = {
  "payload-1kb.bin": 1024,
  "payload-100kb.bin": 100 * 1024,
  "payload-1mb.bin": 1024 * 1024,
};

async function generateSampleImage(): Promise<void> {
  const canvas = new Canvas(IMAGE_SIZE, IMAGE_SIZE);
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, IMAGE_SIZE, IMAGE_SIZE);
  gradient.addColorStop(0, "#1b2a4a");
  gradient.addColorStop(1, "#e0c288");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);

  const imageData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
  const noise = randomBytes(imageData.data.length);
  for (let i = 0; i < imageData.data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const jitter = (noise[i + c]! % 21) - 10; // ±10のノイズを乗せてグラデーションだけにならないようにする
      const index = i + c;
      imageData.data[index] = Math.min(255, Math.max(0, imageData.data[index]! + jitter));
    }
  }
  ctx.putImageData(imageData, 0, 0);

  const png = new PNG({ width: IMAGE_SIZE, height: IMAGE_SIZE });
  png.data = Buffer.from(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);
  await writeFile(`${OUTPUT_DIR}/sample-image.png`, PNG.sync.write(png));
}

async function generatePayloads(): Promise<void> {
  for (const [name, size] of Object.entries(PAYLOAD_SIZES)) {
    await writeFile(`${OUTPUT_DIR}/${name}`, randomBytes(size));
  }
}

await mkdir(OUTPUT_DIR, { recursive: true });
await generateSampleImage();
await generatePayloads();

console.log(`ベンチ用フィクスチャを生成しました: ${OUTPUT_DIR}`);
