import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    // src/core/ (リポジトリルート側)を読み込むため、web/の外へのアクセスを許可する。
    fs: {
      allow: [resolve(currentDir, "..")],
    },
  },
});
