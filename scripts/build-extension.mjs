// 크롬 확장 패키지 만들기: node scripts/build-extension.mjs
// 정식 페이지(index.html·src·vendor)를 그대로 복사하고 확장 전용 파일(extension/)만 더한다.
// 앱 코드는 한 벌만 유지한다. 결과: dist/marking-extension/ 와 dist/marking-extension.zip
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "dist/marking-extension");
rmSync(join(root, "dist"), { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// PWA 매니페스트 링크는 확장에서 쓰지 않으므로 뺀다. 나머지 마크업은 정식 페이지와 같다.
const html = readFileSync(join(root, "index.html"), "utf8");
const stripped = html.replace(/^\s*<link rel="manifest"[^>]*>\s*\n/m, "");
if (stripped === html) throw new Error("index.html에서 매니페스트 링크를 찾지 못했습니다.");
writeFileSync(join(out, "index.html"), stripped);

cpSync(join(root, "src"), join(out, "src"), { recursive: true });

// MediaPipe: 크롬은 SIMD를 지원하므로 SIMD판 WASM만 넣는다(non-SIMD판 약 10MB 제외).
const mp = join(root, "vendor/mediapipe");
const mpOut = join(out, "vendor/mediapipe");
for (const f of ["vision_bundle.mjs", "wasm/vision_wasm_internal.js", "wasm/vision_wasm_internal.wasm",
  "models/blaze_face_full_range.tflite", "models/face_landmarker.task"]) {
  if (!existsSync(join(mp, f))) throw new Error("vendor 파일 없음: " + f);
  cpSync(join(mp, f), join(mpOut, f));
}

const ext = join(root, "extension");
cpSync(join(ext, "manifest.json"), join(out, "manifest.json"));
cpSync(join(ext, "background.js"), join(out, "background.js"));
for (const s of [16, 32, 48, 128]) cpSync(join(ext, `icons/icon${s}.png`), join(out, `icons/icon${s}.png`));

execFileSync("zip", ["-qr", "../marking-extension.zip", "."], { cwd: out });
const v = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")).version;
console.log(`마킹 확장 ${v} → dist/marking-extension.zip`);
