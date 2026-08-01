// 埋め込みデータのフォーマット定義（契約層）。実際のbit詰め込み/取り出しはencode.ts/decode.ts側で行う。
//
// レイアウト:
// ┌─ 固定 HEADER_BITS_PER_CHANNEL で埋め込む区間（本体のbpcを知るための鶏卵問題を避けるため常に固定）
// │   [Magic: MAGIC_LENGTH byte]
// │   [Version: VERSION_LENGTH byte]
// │   [BodyBitsPerChannel: BODY_BITS_PER_CHANNEL_LENGTH byte]
// │
// ├─ ここから BodyBitsPerChannel で埋め込む区間
// │   [FileCount: FILE_COUNT_LENGTH byte]
// │   ├─ File[0]
// │   │   [NameLength: NAME_LENGTH_FIELD_SIZE byte]  (UTF-8 byte長)
// │   │   [Name: NameLength byte]
// │   │   [DataLength: DATA_LENGTH_FIELD_SIZE byte]
// │   ├─ File[1]
// │   │   ...
// │
// └─ 各ファイルの実データ（目次の順番通りに連結）

export const MAGIC = new Uint8Array([0x53, 0x54, 0x47, 0x31]); // ASCII "STG1"
export const MAGIC_LENGTH = MAGIC.length;

export const VERSION = 1;
export const VERSION_LENGTH = 1;

export const BODY_BITS_PER_CHANNEL_LENGTH = 1;

// Magic/Version/BodyBitsPerChannelを埋め込む深度。本体のbpcが決まる前に読む必要があるため固定値。
export const HEADER_BITS_PER_CHANNEL = 1;

export const FILE_COUNT_LENGTH = 2;
export const NAME_LENGTH_FIELD_SIZE = 2;
export const DATA_LENGTH_FIELD_SIZE = 4;

export const MIN_BITS_PER_CHANNEL = 1;
export const MAX_BITS_PER_CHANNEL = 8;

export interface FileEntry {
  name: string;
  dataLength: number;
}

export interface StegoHeader {
  version: number;
  bodyBitsPerChannel: number;
  files: FileEntry[];
}
