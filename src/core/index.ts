// まずは一枚の画像にファイルを埋め込んでから取り出せるとこまでやる
// debug方法、cliから埋め込みとcliから取り出しを試す。
import { readFile } from "node:fs/promises";
import {Image,Canvas} from "canvas"

async function main() {

  const file = await readFile("./public/28078921_m.jpg");

  let image = new Image()
  
  image.src = file

  let canvas = new Canvas(image.width,image.height);
  let ctx = canvas.getContext('2d');
  ctx.drawImage(image,0,0,image.width,image.height)

  
  // ファイルを
}

main();
