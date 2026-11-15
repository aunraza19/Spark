import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { aboutFixture, experimentRows, explanationOk, gas, iss, liquid, lunar, lunarSnapshot, lunarSummary, pageFixture, rankingFixture, report, solid, spacesuit } from "./fixtures";
import { startersFor } from "./starters";

const chatBodies: { block: unknown; messages: { role: string; text: string }[] }[] = [];

function sse(events: unknown[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      controller.close();
    },
  });
  return { ok: true, status: 200, body };
}

class QuietObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function mockApi() {
  chatBodies.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
      if (url === "/api/agent/chat") {
        chatBodies.push(JSON.parse(init?.body as string));
        return sse([{ type: "text", delta: "Here you go." }, { type: "done" }]);
      }
      if (url === "/api/agent/explain") return ok(explanationOk);
      if (url === "/api/habitats") return ok([{ ...lunar, short_name: "lunar zone" }, iss, spacesuit]);
      if (url === "/api/points") return ok([gas, liquid, solid]);
      if (url === "/api/report-conditions") return ok([report]);
      if (url === "/api/about") return ok(aboutFixture);
      if (url === "/api/experiment-list") return ok(experimentRows);
      if (url.startsWith("/api/snapshot/map")) return ok({ key: "k", snapshot: lunarSnapshot, summary: lunarSummary });
      if (url.startsWith("/api/ranking")) return ok(rankingFixture);
      if (url.startsWith("/api/experiment-page/")) return ok(pageFixture);
      return { ok: false, status: 404, json: async () => ({}) };
    }),
  );
}

beforeEach(() => vi.stubGlobal("ResizeObserver", QuietObserver));
afterEach(() => {
  vi.unstubAllGlobals();
  window.location.hash = "";
});

const header = () => document.querySelector("header.site-header") as HTMLElement;
const headerButton = () => within(header()).getByRole("button", { name: "Spark agent" });
const panel = () => screen.queryByRole("complementary", { name: "Spark agent chat" });

describe("the Spark agent button in the page header", () => {
  it("is on the map page, the list of experiments and an experiment page", async () => {
    mockApi();
    const { unmount } = render(<App />);
    expect(headerButton()).toBeInTheDocument();
    unmount();
    window.location.hash = "#experiments";
    const second = render(<App />);
    expect(headerButton()).toBeInTheDocument();
    second.unmount();
    window.location.hash = "#experiment/PSI-25";
    render(<App />);
    expect(headerButton()).toBeInTheDocument();
  });

  it("opens the chat at any time, without asking Spark agent first, about the map of the chosen habitat", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    expect(panel()).toBeNull();
    fireEvent.click(headerButton());
    const chat = await screen.findByRole("complementary", { name: "Spark agent chat" });
    expect(within(chat).getByText("Talking about: lunar zone map")).toBeInTheDocument();
    expect(headerButton()).toHaveAttribute("aria-expanded", "true");
  });

  it("offers the welcome and three starter questions, and sends the one that is pressed with the map's block", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    fireEvent.click(headerButton());
    const chat = await screen.findByRole("complementary", { name: "Spark agent chat" });
    const block = { kind: "map", habitat: "lunar", shown_psi_max: 20 };
    fireEvent.click(within(chat).getByRole("button", { name: startersFor(block as never)[1] }));
    await within(chat).findByText("Here you go.");
    expect(chatBodies[0].block).toEqual(block);
    expect(chatBodies[0].messages).toEqual([{ role: "user", text: startersFor(block as never)[1] }]);
  });

  it("follows the habitat that is chosen on the page", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    fireEvent.click(screen.getByRole("radio", { name: "ISS cabin" }));
    await waitFor(() => expect(screen.getAllByRole("radio", { name: "ISS cabin" })[0]).toBeChecked());
    fireEvent.click(headerButton());
    const chat = await screen.findByRole("complementary", { name: "Spark agent chat" });
    expect(within(chat).getByText("Talking about: ISS cabin map")).toBeInTheDocument();
    fireEvent.click(within(chat).getByRole("button", { name: startersFor({ kind: "map" } as never)[0] }));
    await within(chat).findByText("Here you go.");
    expect(chatBodies[0].block).toEqual({ kind: "map", habitat: "iss", shown_psi_max: 20 });
  });

  it("is about the experiment on an experiment page", async () => {
    window.location.hash = "#experiment/PSI-25";
    mockApi();
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "BASS-II (PSI-25)" });
    fireEvent.click(headerButton());
    const chat = await screen.findByRole("complementary", { name: "Spark agent chat" });
    expect(within(chat).getByText("Talking about: experiment PSI-25")).toBeInTheDocument();
    fireEvent.click(within(chat).getByRole("button", { name: startersFor({ kind: "experiment" } as never)[1] }));
    await within(chat).findByText("Here you go.");
    expect(chatBodies[0].block).toEqual({ kind: "experiment", experiment_id: "PSI-25" });
  });

  it("is about the lunar zone map on the list of experiments, where no view is chosen", async () => {
    window.location.hash = "#experiments";
    mockApi();
    render(<App />);
    await screen.findByRole("heading", { level: 1, name: "All experiments" });
    fireEvent.click(headerButton());
    const chat = await screen.findByRole("complementary", { name: "Spark agent chat" });
    await within(chat).findByText("Talking about: lunar zone map");
  });

  it("closes when the header button is pressed again, and with Escape, giving focus back to the button", async () => {
    mockApi();
    render(<App />);
    await screen.findAllByTestId("point");
    fireEvent.click(headerButton());
    await screen.findByRole("complementary", { name: "Spark agent chat" });
    fireEvent.click(headerButton());
    expect(panel()).toBeNull();
    expect(headerButton()).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(headerButton());
    fireEvent.keyDown(await screen.findByRole("complementary", { name: "Spark agent chat" }), { key: "Escape" });
    expect(panel()).toBeNull();
    await waitFor(() => expect(headerButton()).toHaveFocus());
  });
});

describe("Ask more still opens the same panel, from a block's explanation", () => {
  it("seeds it with that block's explanation and says what it is about", async () => {
    mockApi();
    render(<App />);
    const heading = await screen.findByRole("heading", { name: "What the data says here" });
    const card = heading.closest("section") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Ask Spark agent" }));
    fireEvent.click(await within(card).findByRole("button", { name: "Ask more" }));
    const chat = await screen.findByRole("complementary", { name: "Spark agent chat" });
    expect(within(chat).getByText("Talking about: lunar zone map")).toBeInTheDocument();
    if (explanationOk.status !== "ok") throw new Error("fixture");
    expect(chat.textContent).toContain(explanationOk.answer.seeing);
    expect(within(chat).queryByTestId("chat-welcome")).toBeNull();
  });
});
