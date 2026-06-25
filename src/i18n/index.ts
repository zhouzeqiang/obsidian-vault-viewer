import zhCN from "./zh-CN";
import zhTW from "./zh-TW";
import en from "./en";

const locales: Record<string, Record<string, string | ((...args: any[]) => string)>> = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "en": en,
};

let currentLang = "zh-CN";

export function setLang(lang: string): void {
  if (locales[lang]) currentLang = lang;
}

export function getLang(): string {
  return currentLang;
}

export function t(key: string, ...args: any[]): string {
  const map = locales[currentLang];
  if (!map) return key;
  const val = map[key];
  if (val === undefined) return key;
  return typeof val === "function" ? val(...args) : val;
}
