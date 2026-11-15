import type { TextMessagePartComponent } from "@assistant-ui/react";
import { Fragment, type ReactNode } from "react";

export type Block = { kind: "paragraph"; lines: string[] } | { kind: "bullets" | "numbers"; items: string[] };

const BULLET = /^[-*] (.*)$/;
const NUMBER = /^\d+\. (.*)$/;
const BOLD = /(\*\*(?=\S)[^*]*?\S\*\*)/;

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: Extract<Block, { items: string[] }> | null = null;
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", lines: paragraph });
    paragraph = [];
  };
  for (const line of text.split(/\r?\n/)) {
    const bullet = BULLET.exec(line);
    const number = NUMBER.exec(line);
    if (!line.trim()) {
      flush();
      list = null;
    } else if (bullet || number) {
      flush();
      const kind = bullet ? "bullets" : "numbers";
      if (!list || list.kind !== kind) {
        list = { kind, items: [] };
        blocks.push(list);
      }
      list.items.push(((bullet ?? number) as RegExpExecArray)[1]);
    } else {
      list = null;
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

function inline(line: string): ReactNode {
  return line.split(BOLD).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>,
  );
}

/** Paragraphs, bullet and numbered lists, and bold. Everything else is shown as written. React escapes all of it. */
export const MarkdownText: TextMessagePartComponent = ({ text }) => (
  <>
    {parseMarkdown(text).map((block, index) => {
      if (block.kind === "paragraph") {
        return (
          <p key={index}>
            {block.lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {inline(line)}
              </Fragment>
            ))}
          </p>
        );
      }
      const items = block.items.map((item, i) => <li key={i}>{inline(item)}</li>);
      return block.kind === "bullets" ? <ul key={index}>{items}</ul> : <ol key={index}>{items}</ol>;
    })}
  </>
);
