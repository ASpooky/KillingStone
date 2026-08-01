import type { ImageData } from "canvas";
import { extractFiles, type DecodedFile } from "./steganography.ts";

export type { DecodedFile };

export function imageDataToFiles(image: ImageData): DecodedFile[] {
  return extractFiles(image);
}
