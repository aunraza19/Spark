import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { MarkdownText, parseMarkdown } from "./safeMarkdown";

const show = (text: string) =>
  render(<MarkdownText {...({ type: "text", text, status: { type: "complete" } } as unknown as ComponentProps<typeof MarkdownText>)} />);

describe("parseMarkdown", () => {
  it("splits paragraphs at blank lines and keeps line breaks inside one", () => {
    expect(parseMarkdown("One.\nStill one.\n\nTwo.")).toEqual([
      { kind: "paragraph", lines: ["One.", "Still one."] },
      { kind: "paragraph", lines: ["Two."] },
    ]);
  });

  it("reads bullet lists, with - or *", () => {
    expect(parseMarkdown("- a\n- b\n* c")).toEqual([{ kind: "bullets", items: ["a", "b", "c"] }]);
  });

  it("reads numbered lists", () => {
    expect(parseMarkdown("1. a\n2. b")).toEqual([{ kind: "numbers", items: ["a", "b"] }]);
  });

  it("puts a list that follows a sentence in its own block", () => {
    expect(parseMarkdown("Tests:\n- a\n- b")).toEqual([
      { kind: "paragraph", lines: ["Tests:"] },
      { kind: "bullets", items: ["a", "b"] },
    ]);
  });
});

describe("MarkdownText", () => {
  it("shows paragraphs, lists and bold", () => {
    show("Three kinds.\n\n- **Gas**: 20 tests\n- Liquid: none\n\n1. First\n2. Second");
    expect(screen.getByText("Three kinds.").tagName).toBe("P");
    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("Gas").tagName).toBe("STRONG");
  });

  it("shows markup as plain text, never as markup", () => {
    const { container } = show("<script>alert(1)</script> and <b>bold</b> and <img src=x onerror=alert(1)>");
    expect(container.querySelector("script, b, img")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("does not make links, headings or code: they stay as written", () => {
    const { container } = show("# Heading\n\n[a link](http://example.com) and `code`");
    expect(container.querySelector("a, h1, h2, h3, code")).toBeNull();
    expect(container.textContent).toContain("# Heading");
    expect(container.textContent).toContain("[a link](http://example.com)");
  });

  it("leaves a lone pair of asterisks alone", () => {
    const { container } = show("2 ** 3 and **unfinished");
    expect(container.querySelector("strong")).toBeNull();
    expect(container.textContent).toContain("**unfinished");
  });

  it("renders nothing for empty text", () => {
    const { container } = show("");
    expect(container.textContent).toBe("");
  });
});
