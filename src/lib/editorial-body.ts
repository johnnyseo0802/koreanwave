export type EditorialBlock =
  | { type: "paragraph" | "heading"; text: string }
  | { type: "list"; items: string[] };

// A small line grammar, not Markdown: no HTML, links, attributes or inline markup.
export function parseEditorialBody(body: string): EditorialBlock[] {
  const blocks: EditorialBlock[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  const flushList = () => {
    if (items.length) blocks.push({ type: "list", items });
    items = [];
  };
  for (const raw of body.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    const explicit = /^## (\S.*)$/.exec(line);
    const numbered = /^[1-9]\d?\. \S/.test(line);
    const bullet = /^(?:•|-) (\S.*)$/.exec(line);
    if (explicit || numbered) {
      flushParagraph(); flushList();
      blocks.push({ type: "heading", text: explicit ? explicit[1] : line });
    } else if (bullet) {
      flushParagraph(); items.push(bullet[1]);
    } else {
      flushList(); paragraph.push(line);
    }
  }
  flushParagraph(); flushList();
  return blocks;
}
