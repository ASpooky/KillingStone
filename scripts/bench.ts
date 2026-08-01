// encode/decodeの速度をNode標準のperf_hooksで測る。
// payloadサイズ×bitsPerChannelの組み合わせごとにencode/decodeをREPETITIONS回実行し、最速値を採用する
// (JITウォームアップ・GC等のノイズを避けるため平均ではなく最小値で見る)。
import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { fileToImageData } from "../src/core/encode.ts";
import { imageDataToFiles } from "../src/core/decode.ts";

const BENCH_DIR = "./public/bench";
const BITS_PER_CHANNEL_VALUES = [1, 2, 4, 8];
const PAYLOAD_FILES = ["payload-1kb.bin", "payload-100kb.bin", "payload-1mb.bin"];
const REPETITIONS = 5;

async function measureBest<T>(fn: () => T | Promise<T>): Promise<{ result: T; ms: number }> {
  let best = Infinity;
  let lastResult: T | undefined;

  for (let i = 0; i < REPETITIONS; i++) {
    const start = performance.now();
    lastResult = await fn();
    const elapsed = performance.now() - start;
    best = Math.min(best, elapsed);
  }

  return { result: lastResult!, ms: best };
}

async function main(): Promise<void> {
  const carrierBytes = await readFile(`${BENCH_DIR}/sample-image.png`);
  const carrierFile = new File([carrierBytes], "sample-image.png");

  const rows: Record<string, string | number>[] = [];

  for (const payloadName of PAYLOAD_FILES) {
    const payloadBytes = await readFile(`${BENCH_DIR}/${payloadName}`);
    const payloadFile = new File([payloadBytes], payloadName);

    for (const bitsPerChannel of BITS_PER_CHANNEL_VALUES) {
      const { result: encodedImageData, ms: encodeMs } = await measureBest(() =>
        fileToImageData({ files: [payloadFile], imageFile: carrierFile, bitsPerChannel }),
      );

      const { result: decodedFiles, ms: decodeMs } = await measureBest(() => imageDataToFiles(encodedImageData));

      const decodedBytes = Buffer.from(decodedFiles[0]!.data);
      if (Buffer.compare(decodedBytes, payloadBytes) !== 0) {
        throw new Error(`ラウンドトリップ検証に失敗しました(payload: ${payloadName}, bitsPerChannel: ${bitsPerChannel})`);
      }

      rows.push({
        payload: payloadName,
        bitsPerChannel,
        "encode(ms)": encodeMs.toFixed(2),
        "decode(ms)": decodeMs.toFixed(2),
      });
    }
  }

  console.table(rows);
}

await main();
