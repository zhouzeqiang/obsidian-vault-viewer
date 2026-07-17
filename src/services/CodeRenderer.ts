import * as Prism from "prismjs";
import "prismjs/components/prism-java";
import "prismjs/components/prism-python";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-css";
import "prismjs/components/prism-scss";
import "prismjs/components/prism-less";
import "prismjs/components/prism-stylus";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-powershell";
import "prismjs/components/prism-batch";
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-php";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-scala";
import "prismjs/components/prism-groovy";
import "prismjs/components/prism-perl";
import "prismjs/components/prism-lua";
import "prismjs/components/prism-r";
import "prismjs/components/prism-objectivec";
import "prismjs/components/prism-dart";
import "prismjs/components/prism-erlang";
import "prismjs/components/prism-elixir";
import "prismjs/components/prism-coffeescript";
import "prismjs/components/prism-latex";
import "prismjs/components/prism-rest";
import "prismjs/components/prism-toml";
import "prismjs/components/prism-ini";
import "prismjs/components/prism-properties";
import "prismjs/components/prism-makefile";

const EXT_TO_LANG: Record<string, string> = {
  java: "java",
  py: "python",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  jsx: "jsx",
  json: "json",
  xml: "markup",
  html: "markup",
  htm: "markup",
  vue: "markup",
  yaml: "yaml",
  yml: "yaml",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "less",
  styl: "stylus",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  ps1: "powershell",
  psm1: "powershell",
  psd1: "powershell",
  bat: "batch",
  cmd: "batch",
  php: "php",
  php3: "php",
  php4: "php",
  php5: "php",
  phtml: "php",
  rb: "ruby",
  go: "go",
  rs: "rust",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  hxx: "cpp",
  cs: "csharp",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
  scala: "scala",
  groovy: "groovy",
  gradle: "groovy",
  pl: "perl",
  pm: "perl",
  lua: "lua",
  r: "r",
  R: "r",
  rmd: "r",
  m: "objectivec",
  mm: "objectivec",
  dart: "dart",
  erl: "erlang",
  ex: "elixir",
  exs: "elixir",
  coffee: "coffeescript",
  tex: "latex",
  sty: "latex",
  cls: "latex",
  ltx: "latex",
  rst: "rest",
  toml: "toml",
  ini: "ini",
  cfg: "ini",
  conf: "ini",
  env: "ini",
  properties: "properties",
  makefile: "makefile",
  Makefile: "makefile",
};

const MAX_BYTES = 500 * 1024;
const MAX_LINES = 2000;

export function extensionToLanguage(ext: string): string {
  return EXT_TO_LANG[ext.toLowerCase()] ?? "";
}

export function highlight(content: string, extension: string): string {
  if (!content) return "";
  const lang = extensionToLanguage(extension);
  let truncated = false;

  const encoder = new TextEncoder();
  if (encoder.encode(content).length > MAX_BYTES) {
    const lines = content.split("\n");
    if (lines.length > MAX_LINES) {
      content = lines.slice(0, MAX_LINES).join("\n");
      truncated = true;
    }
  }

  try {
    if (lang && Prism.languages[lang]) {
      const html = Prism.highlight(content, Prism.languages[lang], lang);
      return truncated ? html + `<p class="code-truncated">(File truncated, showing first ${MAX_LINES} lines)</p>` : html;
    }
  } catch {
  }

  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return truncated
    ? escaped + `<p class="code-truncated">(File truncated, showing first ${MAX_LINES} lines)</p>`
    : escaped;
}

export const SUPPORTED_EXTENSIONS = new Set(Object.keys(EXT_TO_LANG));
