import { extensionToLanguage, highlight } from "../src/services/CodeRenderer";

describe("extensionToLanguage", () => {
  const cases: [string, string][] = [
    ["java", "java"],
    ["py", "python"],
    ["Py", "python"],
    ["js", "javascript"],
    ["JS", "javascript"],
    ["ts", "typescript"],
    ["Ts", "typescript"],
    ["json", "json"],
    ["xml", "markup"],
    ["yaml", "yaml"],
    ["css", "css"],
    ["html", "markup"],
    ["sh", "bash"],
    ["ps1", "powershell"],
    ["bat", "batch"],
    ["sql", "sql"],
    ["php", "php"],
    ["rb", "ruby"],
    ["go", "go"],
    ["rs", "rust"],
    ["c", "c"],
    ["cpp", "cpp"],
    ["cs", "csharp"],
    ["swift", "swift"],
    ["kt", "kotlin"],
    ["scala", "scala"],
    ["pl", "perl"],
    ["lua", "lua"],
    ["r", "r"],
    ["dart", "dart"],
    ["erl", "erlang"],
    ["ex", "elixir"],
    ["coffee", "coffeescript"],
    ["tex", "latex"],
    ["toml", "toml"],
    ["ini", "ini"],
    ["properties", "properties"],
    ["makefile", "makefile"],
    ["txt", ""],
    ["dockerfile", ""],
    ["gitignore", ""],
  ];

  test.each(cases)(".extensionToLanguage(%s) returns %s", (ext, expected) => {
    expect(extensionToLanguage(ext)).toBe(expected);
  });
});

describe("highlight", () => {
  test("highlights Python keywords", () => {
    const html = highlight("def foo():\n    pass", "py");
    expect(html).toContain('class="token keyword"');
  });

  test("highlights JavaScript strings", () => {
    const html = highlight('const x = "hello";', "js");
    expect(html).toContain('class="token string"');
  });

  test("highlights TypeScript types", () => {
    const html = highlight("const x: number = 42;", "ts");
    expect(html).toContain('class="token keyword"');
  });

  test("highlights SQL keywords", () => {
    const html = highlight("SELECT * FROM users;", "sql");
    expect(html).toContain('class="token keyword"');
  });

  test("returns plain text for unknown extension", () => {
    const html = highlight("hello world", "txt");
    expect(html).not.toContain('class="token');
  });

  test("truncates content over 500 KB", () => {
    const line = "// test line\n";
    const size = 600 * 1024;
    const big = line.repeat(Math.ceil(size / line.length));
    const result = highlight(big, "js");
    expect(result).toContain("truncated");
    expect(result).toContain("2000");
  });

  test("handles empty content", () => {
    const html = highlight("", "js");
    expect(html).toBe("");
  });

  test("falls back to plain text on prism error", () => {
    const html = highlight("normal text", "js");
    expect(html).toBeTruthy();
  });
});
