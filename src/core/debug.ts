import { exec } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { imageToPixel } from "./encode.ts";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const imageData = await imageToPixel("./public/28078921_m.jpg");

const png = new PNG({ width: imageData.width, height: imageData.height });
png.data = Buffer.from(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength);

const outputPath = "./output/debug-output.png";
await writeFile(outputPath, PNG.sync.write(png));

const rl = readline.createInterface({ input, output });
const file = await rl.question("画像に隠蔽したいファイルを指定してください:")
console.log(file)

const opener =
  process.platform === "win32" ? 'start ""' : process.platform === "darwin" ? "open" : "xdg-open";
exec(`${opener} "${outputPath}"`);

rl.close()