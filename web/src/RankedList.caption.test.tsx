import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RankedList } from "./RankedList";
import { rankingFixture } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());

describe("what the bars mean", () => {
  it("says it in one line above the list, in words and without numbers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => rankingFixture })));
    render(<RankedList selection={{ habitatId: "lunar" }} />);
    const caption = await screen.findByText("Each bar shows how close the tests of an experiment came to this atmosphere.");
    const list = screen.getAllByRole("list")[0];
    expect(Boolean(caption.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });
});
