import { exec } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { imageToPixel } from "./encode.ts";

const imageData = await imageToPixel("./public/28078921_m.jpg");

const png = new PNG({ width: imageData.width, height: imageData.height });
png.data = Buffer.from(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);

const outputPath = "./output/debug-output.png";
await writeFile(outputPath, PNG.sync.write(png));

console.log("画像に隠蔽したいファイルを指定してください")
const file = await process.stdin
console.log(file)

const opener =
  process.platform === "win32" ? 'start ""' : process.platform === "darwin" ? "open" : "xdg-open";
exec(`${opener} "${outputPath}"`);
