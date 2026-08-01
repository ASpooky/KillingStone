import { writeFile } from "node:fs/promises";
import { PNG } from "pngjs";
import { fileToImageData } from "./encode.ts";
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { readFile } from "node:fs/promises"
import { basename } from "node:path"

const carrierPath = "./public/28078921_m.jpg";
const carrierFile = new File([await readFile(carrierPath)], carrierPath);

const rl = readline.createInterface({ input, output });
const file = (await rl.question("画像に隠蔽したいファイルを指定してください:")).trim().replace(/^['"]|['"]$/g, "")
const bitsPerChannel = Number(await rl.question("1channelあたり何bit埋め込む？(1-8):"))
rl.close()

const inputFile = new File([await readFile(file)],basename(file))

const encodedImageData = await fileToImageData({files:[inputFile],imageFile:carrierFile,bitsPerChannel})

const png = new PNG({ width: encodedImageData.width, height: encodedImageData.height });
png.data = Buffer.from(encodedImageData.data.buffer, encodedImageData.data.byteOffset, encodedImageData.data.byteLength);

const outputPath = "./output/debug-output.png";
await writeFile(outputPath, PNG.sync.write(png));