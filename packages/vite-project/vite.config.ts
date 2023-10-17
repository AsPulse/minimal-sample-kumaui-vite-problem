import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

import { transform } from "@kuma-ui/babel-plugin";
import { Plugin } from "vite";
import path from "path";
import { buildSync } from "esbuild";
import _eval from "eval";
import { theme, sheet, UserTheme } from "@kuma-ui/sheet";
import { readdirSync } from "fs";

export function kumaUI(): Plugin {
  let mode: "build" | "serve";

  const dir = readdirSync(".");
  let configPath: string | undefined;
  dir.forEach((filePath) => {
    if (filePath.startsWith("kuma.config.")) configPath = filePath;
  });

  if (configPath) {
    const filename = path.join(process.cwd(), configPath);
    const result = buildSync({
      bundle: true,
      target: "es2017",
      write: false,
      platform: "node",
      format: typeof require !== "undefined" ? "cjs" : "esm",
      absWorkingDir: process.cwd(),
      outfile: filename + ".out",
      entryPoints: [filename],
      logLevel: "silent",
    });

    const config = _eval(result.outputFiles[0].text, configPath) as {
      default: Partial<UserTheme>;
    };

    if (config.default) {
      theme.setUserTheme(config.default);
    }
  }

  const cssTable: {
    url: string,
    css: string,
  }[] = [];

  const virtualModuleId = "virtual:kuma-ui";

  const userTheme = theme.getUserTheme();

  return {
    name: "kuma-ui",
    enforce: "pre",
    config(config) {
      if (!config.define) config.define = {};
      config.define = Object.assign(config.define, {
        "globalThis.__KUMA_USER_THEME__": JSON.stringify(userTheme),
      });
      return config;
    },
    transform(code: string, id: string) {
      if (id.includes("@kuma-ui")) return;
      if (!/\.(t|j)(s|sx)?$/.test(id)) return;
      if (/node_modules/.test(id)) return;
      if (!code.includes("@kuma-ui/core")) return;

      const result = transform(code, id);
      if (!result?.code) return;
      const css = (result.metadata as unknown as { css: string }).css || "";

      const cssTableId = `${Date.now().toString(16)}x${cssTable.length}`;
      const url = `${virtualModuleId}/${cssTableId}.css`;
      cssTable.push({ url, css });

      sheet.reset();
      return (
        `import "${url}";
` + result.code
      );
    },
    load(url) {
      if (!url.startsWith(`\0${virtualModuleId}`)) return undefined;
      return cssTable.find(c => `\0${c.url}` === url)?.css ?? undefined;
    },
    resolveId(importeeUrl) {
      if (!importeeUrl.startsWith(virtualModuleId)) return undefined;
      const css = cssTable.find(c => c.url === importeeUrl);
      return css === null ? undefined : `\0${css.url}`;
    },
    handleHotUpdate({ server }) {
      sheet.reset();
      cssTable.length = 0;
      server.ws.send({ type: "full-reload" });
    },
    configResolved(config) {
      if (config.define && Object.keys(config.define).length > 0) {
        config.configFileDependencies.push(`${config.root}/kuma.config.ts`);
      }
      mode = config.command;
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), kumaUI()],
})
