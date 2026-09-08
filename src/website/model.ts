/** Customer-facing content only. Internal evidence and capture instructions live in docs/. */
export type Inline = string | { text: string; href: string } | { code: string };
export type Block =
  | { type: "paragraph"; text: Inline[] }
  | { type: "list"; ordered?: boolean; items: Inline[][] }
  | { type: "note"; tone: "note" | "warning"; title: string; text: Inline[] }
  | { type: "code"; language: "bash" | "yaml" | "json"; label: string; value: string }
  | { type: "table"; columns: string[]; rows: string[][] }
  | { type: "capture"; id: string };
export type Section = { id: string; title: string; blocks: Block[] };
export type Article = {
  slug: string; title: string; description: string; group: string;
  keywords: string[]; sections: Section[];
};
export const paragraph = (...text: Inline[]): Block => ({ type: "paragraph", text });
export const note = (title: string, ...text: Inline[]): Block => ({ type: "note", tone: "note", title, text });
export const warning = (title: string, ...text: Inline[]): Block => ({ type: "note", tone: "warning", title, text });
export const list = (...items: Inline[][]): Block => ({ type: "list", items });
export const steps = (...items: Inline[][]): Block => ({ type: "list", ordered: true, items });
export const code = (language: "bash" | "yaml" | "json", label: string, value: string): Block => ({ type: "code", language, label, value });
export const table = (columns: string[], rows: string[][]): Block => ({ type: "table", columns, rows });
export const capture = (id: string): Block => ({ type: "capture", id });
export const link = (text: string, href: string): Inline => ({ text, href });
export const mono = (code: string): Inline => ({ code });
export const section = (id: string, title: string, ...blocks: Block[]): Section => ({ id, title, blocks });
export function inlineText(parts: Inline[]): string {
  return parts.map(part => typeof part === "string" ? part : "code" in part ? part.code : part.text).join("");
}
export function blockText(block: Block): string {
  switch (block.type) {
    case "paragraph": return inlineText(block.text);
    case "note": return `${block.title} ${inlineText(block.text)}`;
    case "list": return block.items.map(inlineText).join(" ");
    case "code": return `${block.label} ${block.value}`;
    case "table": return [...block.columns, ...block.rows.flat()].join(" ");
    case "capture": return "";
  }
}
