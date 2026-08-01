// Node/ブラウザ共通の埋め込み・復号ロジック。Node固有(canvasパッケージ)・ブラウザ固有(DOM)のAPIには依存しない。
// 画像バイト列⇄ImageDataの変換だけは実行環境ごとに異なるので、呼び出し側(encode.ts/web側)が担う。
import {
  MAGIC,
  VERSION,
  HEADER_BITS_PER_CHANNEL,
  FILE_COUNT_LENGTH,
  NAME_LENGTH_FIELD_SIZE,
  DATA_LENGTH_FIELD_SIZE,
  MAGIC_LENGTH,
  VERSION_LENGTH,
  BODY_BITS_PER_CHANNEL_LENGTH,
  MIN_BITS_PER_CHANNEL,
  MAX_BITS_PER_CHANNEL,
} from "./protocol.ts";

// DOM/canvasパッケージ両方のImageDataが構造的に満たす最小限の形。
export interface RawImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface DecodedFile {
  name: string;
  data: Uint8Array;
}

export interface EmbedInput {
  files: File[];
  image: RawImageData;
  bitsPerChannel?: number | undefined;
}

// pixelsへbitsPerChannel単位でbitを詰め込むカーソル。PixelBitReaderと対になっており、
// 書き込む順序(pixelの下位bitsPerChannel bitをMSBから詰める)は共通。
class PixelBitWriter {
  private readonly pixels: Uint8ClampedArray;
  private readonly bitsPerChannel: number;
  private readonly clearMask: number;
  private readonly channelMask: number;
  private pixelIndex: number;
  // 直前までに書き込みきれなかった端数bit(常にbitsPerChannel未満)を、下位residualBits bitに保持する。
  private residual = 0;
  private residualBits = 0;

  constructor(pixels: Uint8ClampedArray, bitsPerChannel: number, startPixelIndex: number) {
    if (
      !Number.isInteger(bitsPerChannel) ||
      bitsPerChannel < MIN_BITS_PER_CHANNEL ||
      bitsPerChannel > MAX_BITS_PER_CHANNEL
    ) {
      throw new Error(`bitsPerChannelは${MIN_BITS_PER_CHANNEL}〜${MAX_BITS_PER_CHANNEL}の整数で指定してください`);
    }
    this.pixels = pixels;
    this.bitsPerChannel = bitsPerChannel;
    this.clearMask = (0xff << bitsPerChannel) & 0xff;
    this.channelMask = (1 << bitsPerChannel) - 1;
    this.pixelIndex = startPixelIndex;
  }

  get nextPixelIndex(): number {
    return this.pixelIndex;
  }

  writeBytes(bytes: Uint8Array): void {
    for (const byte of bytes) {
      let buffer = (this.residual << 8) | byte;
      let bufferBits = this.residualBits + 8;

      while (bufferBits >= this.bitsPerChannel) {
        bufferBits -= this.bitsPerChannel;
        const chunk = (buffer >> bufferBits) & this.channelMask;
        this.pixels[this.pixelIndex] = (this.pixels[this.pixelIndex]! & this.clearMask) | chunk;
        this.pixelIndex++;
      }

      buffer &= (1 << bufferBits) - 1;
      this.residual = buffer;
      this.residualBits = bufferBits;
    }
  }

  // 端数bitを0埋めして最後のpixelに書き込む。別のbpcで次の区間を書き始める前に呼ぶ。
  flush(): void {
    if (this.residualBits === 0) {
      return;
    }
    const chunk = (this.residual << (this.bitsPerChannel - this.residualBits)) & this.channelMask;
    this.pixels[this.pixelIndex] = (this.pixels[this.pixelIndex]! & this.clearMask) | chunk;
    this.pixelIndex++;
    this.residual = 0;
    this.residualBits = 0;
  }
}

// pixelsからbitsPerChannel単位でbitを取り出してbyte列に組み立てるカーソル。PixelBitWriterと対になっている。
class PixelBitReader {
  private readonly pixels: Uint8ClampedArray;
  private readonly bitsPerChannel: number;
  private readonly channelMask: number;
  private pixelIndex: number;
  // pixelから読んだが、まだbyteとして取り出せていない端数bitを保持する。
  private residual = 0;
  private residualBits = 0;

  constructor(pixels: Uint8ClampedArray, bitsPerChannel: number, startPixelIndex: number) {
    this.pixels = pixels;
    this.bitsPerChannel = bitsPerChannel;
    this.channelMask = (1 << bitsPerChannel) - 1;
    this.pixelIndex = startPixelIndex;
  }

  get nextPixelIndex(): number {
    return this.pixelIndex;
  }

  readBytes(byteCount: number): Uint8Array {
    const bytes = new Uint8Array(byteCount);

    for (let i = 0; i < byteCount; i++) {
      while (this.residualBits < 8) {
        const pixelValue = this.pixels[this.pixelIndex]!;
        this.pixelIndex++;
        this.residual = (this.residual << this.bitsPerChannel) | (pixelValue & this.channelMask);
        this.residualBits += this.bitsPerChannel;
      }

      this.residualBits -= 8;
      bytes[i] = (this.residual >> this.residualBits) & 0xff;
      this.residual &= (1 << this.residualBits) - 1;
    }

    return bytes;
  }
}

function assertCapacity(availablePixels: number, bitsPerChannel: number, neededBits: number): void {
  const capacityBits = availablePixels * bitsPerChannel;
  if (neededBits > capacityBits) {
    const neededBytes = Math.ceil(neededBits / 8);
    const capacityBytes = Math.floor(capacityBits / 8);
    throw new Error(
      `埋め込みたいデータが大きすぎて、この画像には収まりません(必要: ${neededBytes}byte, 収容可能: ${capacityBytes}byte)`,
    );
  }
}

function uint16Bytes(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, false);
  return bytes;
}

function uint32Bytes(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

export async function embedFiles(input: EmbedInput): Promise<RawImageData> {
  if (input.files.length === 0) {
    throw new Error("埋め込むファイルが1つも指定されていません");
  }

  const bodyBitsPerChannel = input.bitsPerChannel ?? 1;
  const pixels = new Uint8ClampedArray(input.image.data);

  const textEncoder = new TextEncoder();
  const fileEntries = await Promise.all(
    input.files.map(async (file) => ({
      nameBytes: textEncoder.encode(file.name),
      dataBytes: new Uint8Array(await file.arrayBuffer()),
    })),
  );

  // Magic/Version/BodyBitsPerChannelは、本体のbpcを知るために必要な情報なので固定bpcで埋め込む。
  const headerWriter = new PixelBitWriter(pixels, HEADER_BITS_PER_CHANNEL, 0);
  headerWriter.writeBytes(MAGIC);
  headerWriter.writeBytes(Uint8Array.of(VERSION));
  headerWriter.writeBytes(Uint8Array.of(bodyBitsPerChannel));
  headerWriter.flush();

  const tocBits = fileEntries.reduce(
    (sum, entry) => sum + (NAME_LENGTH_FIELD_SIZE + entry.nameBytes.length + DATA_LENGTH_FIELD_SIZE) * 8,
    0,
  );
  const dataBits = fileEntries.reduce((sum, entry) => sum + entry.dataBytes.length * 8, 0);
  const bodyBits = FILE_COUNT_LENGTH * 8 + tocBits + dataBits;
  assertCapacity(pixels.length - headerWriter.nextPixelIndex, bodyBitsPerChannel, bodyBits);

  // [FileCount][NameLength][Name][DataLength]... の目次に続けて、各ファイルの実データを順番に連結する。
  const bodyWriter = new PixelBitWriter(pixels, bodyBitsPerChannel, headerWriter.nextPixelIndex);
  bodyWriter.writeBytes(uint16Bytes(fileEntries.length));
  for (const { nameBytes, dataBytes } of fileEntries) {
    bodyWriter.writeBytes(uint16Bytes(nameBytes.length));
    bodyWriter.writeBytes(nameBytes);
    bodyWriter.writeBytes(uint32Bytes(dataBytes.length));
  }
  for (const { dataBytes } of fileEntries) {
    bodyWriter.writeBytes(dataBytes);
  }
  bodyWriter.flush();

  return { data: pixels, width: input.image.width, height: input.image.height };
}

export function extractFiles(image: RawImageData): DecodedFile[] {
  const pixels = image.data;

  const headerReader = new PixelBitReader(pixels, HEADER_BITS_PER_CHANNEL, 0);

  const magicBytes = headerReader.readBytes(MAGIC_LENGTH);
  const isMagicValid = magicBytes.every((byte, i) => byte === MAGIC[i]);
  if (!isMagicValid) {
    throw new Error("この画像には埋め込みデータが見つかりません");
  }

  const version = headerReader.readBytes(VERSION_LENGTH)[0]!;
  if (version !== VERSION) {
    throw new Error(`対応していないバージョンの埋め込みデータです(version: ${version})`);
  }

  const bodyBitsPerChannel = headerReader.readBytes(BODY_BITS_PER_CHANNEL_LENGTH)[0]!;

  const bodyReader = new PixelBitReader(pixels, bodyBitsPerChannel, headerReader.nextPixelIndex);

  const fileCount = new DataView(bodyReader.readBytes(FILE_COUNT_LENGTH).buffer).getUint16(0, false);

  const textDecoder = new TextDecoder();
  const names: string[] = [];
  const dataLengths: number[] = [];

  for (let i = 0; i < fileCount; i++) {
    const nameLength = new DataView(bodyReader.readBytes(NAME_LENGTH_FIELD_SIZE).buffer).getUint16(0, false);
    names.push(textDecoder.decode(bodyReader.readBytes(nameLength)));
    dataLengths.push(new DataView(bodyReader.readBytes(DATA_LENGTH_FIELD_SIZE).buffer).getUint32(0, false));
  }

  return names.map((name, i) => ({
    name,
    data: bodyReader.readBytes(dataLengths[i]!),
  }));
}
