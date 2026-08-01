import { embedFiles, extractFiles, type DecodedFile } from "../../src/core/steganography.ts";
import { fileToRawImageData, rawImageDataToCanvas, canvasToPngBlob } from "./browser-image.ts";

function requireElement<T extends Element>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`要素が見つかりません: #${id}`);
  }
  return element as T;
}

function showError(element: HTMLElement, message: string): void {
  element.textContent = message;
  element.hidden = false;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const modeButtons = document.querySelectorAll<HTMLButtonElement>(".mode-button");
const encodePanel = requireElement<HTMLElement>("encode-panel");
const decodePanel = requireElement<HTMLElement>("decode-panel");

const carrierImageInput = requireElement<HTMLInputElement>("carrier-image");
const payloadFilesInput = requireElement<HTMLInputElement>("payload-files");
const bitsPerChannelInput = requireElement<HTMLInputElement>("bits-per-channel");
const bitsPerChannelValue = requireElement<HTMLElement>("bits-per-channel-value");
const encodeButton = requireElement<HTMLButtonElement>("encode-button");
const encodeError = requireElement<HTMLElement>("encode-error");
const encodeResult = requireElement<HTMLElement>("encode-result");
const encodePreview = requireElement<HTMLCanvasElement>("encode-preview");
const encodeDownload = requireElement<HTMLAnchorElement>("encode-download");

const stegoImageInput = requireElement<HTMLInputElement>("stego-image");
const decodeButton = requireElement<HTMLButtonElement>("decode-button");
const decodeError = requireElement<HTMLElement>("decode-error");
const decodedFilesList = requireElement<HTMLUListElement>("decoded-files");
const saveSelectedButton = requireElement<HTMLButtonElement>("save-selected-button");

// --- モード切り替え ---
for (const button of modeButtons) {
  button.addEventListener("click", () => {
    const mode = button.dataset["mode"];
    for (const other of modeButtons) {
      const isActive = other === button;
      other.classList.toggle("is-active", isActive);
      other.setAttribute("aria-selected", String(isActive));
    }
    encodePanel.hidden = mode !== "encode";
    decodePanel.hidden = mode !== "decode";
  });
}

// --- bitsPerChannelスライダー ---
bitsPerChannelInput.addEventListener("input", () => {
  bitsPerChannelValue.textContent = bitsPerChannelInput.value;
});

// --- Encode ---
let currentDownloadUrl: string | null = null;

encodeButton.addEventListener("click", () => {
  void handleEncode();
});

async function handleEncode(): Promise<void> {
  encodeError.hidden = true;
  encodeResult.hidden = true;

  const carrierFile = carrierImageInput.files?.[0];
  const payloadFiles = payloadFilesInput.files ? Array.from(payloadFilesInput.files) : [];
  const bitsPerChannel = Number(bitsPerChannelInput.value);

  if (!carrierFile) {
    showError(encodeError, "キャリア画像を選択してください");
    return;
  }
  if (payloadFiles.length === 0) {
    showError(encodeError, "埋め込むファイルを選択してください");
    return;
  }

  try {
    const carrierImage = await fileToRawImageData(carrierFile);
    const result = await embedFiles({ files: payloadFiles, image: carrierImage, bitsPerChannel });

    const canvas = rawImageDataToCanvas(result);
    encodePreview.width = canvas.width;
    encodePreview.height = canvas.height;
    const previewCtx = encodePreview.getContext("2d");
    if (!previewCtx) {
      throw new Error("Canvas 2D contextを取得できませんでした");
    }
    previewCtx.drawImage(canvas, 0, 0);

    const blob = await canvasToPngBlob(canvas);
    if (currentDownloadUrl) {
      URL.revokeObjectURL(currentDownloadUrl);
    }
    currentDownloadUrl = URL.createObjectURL(blob);
    encodeDownload.href = currentDownloadUrl;

    encodeResult.hidden = false;
  } catch (error) {
    showError(encodeError, error instanceof Error ? error.message : String(error));
  }
}

// --- Decode ---
let decodedFiles: DecodedFile[] = [];

decodeButton.addEventListener("click", () => {
  void handleDecode();
});

async function handleDecode(): Promise<void> {
  decodeError.hidden = true;
  decodedFilesList.hidden = true;
  decodedFilesList.innerHTML = "";
  saveSelectedButton.hidden = true;

  const stegoFile = stegoImageInput.files?.[0];
  if (!stegoFile) {
    showError(decodeError, "画像を選択してください");
    return;
  }

  try {
    const stegoImage = await fileToRawImageData(stegoFile);
    decodedFiles = extractFiles(stegoImage);

    if (decodedFiles.length === 0) {
      showError(decodeError, "埋め込まれたファイルが見つかりませんでした");
      return;
    }

    renderDecodedFiles(decodedFiles);
    decodedFilesList.hidden = false;
    saveSelectedButton.hidden = false;
  } catch (error) {
    showError(decodeError, error instanceof Error ? error.message : String(error));
  }
}

function renderDecodedFiles(files: DecodedFile[]): void {
  decodedFilesList.innerHTML = "";

  files.forEach((file, index) => {
    const item = document.createElement("li");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    checkbox.dataset["index"] = String(index);

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = file.name;

    const size = document.createElement("span");
    size.className = "file-size";
    size.textContent = formatBytes(file.data.length);

    item.append(checkbox, name, size);
    decodedFilesList.append(item);
  });
}

function downloadFile(file: DecodedFile): void {
  const blob = new Blob([file.data]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

saveSelectedButton.addEventListener("click", () => {
  const checkboxes = decodedFilesList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked');
  for (const checkbox of checkboxes) {
    const index = Number(checkbox.dataset["index"]);
    const file = decodedFiles[index];
    if (!file) {
      continue;
    }
    downloadFile(file);
  }
});
