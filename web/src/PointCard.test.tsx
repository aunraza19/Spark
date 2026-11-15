import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PointCard } from "./PointCard";
import { gas, gasCard, report, reportCard, solidCard } from "./fixtures";

const requested: string[] = [];

function mockCard(card: unknown, ok = true) {
  requested.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(url);
      return { ok, status: ok ? 200 : 500, json: async () => card };
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

const gasRequest = { source_file: gas.source_file, source_row: 2 };

describe("PointCard", () => {
  it("asks the API for a test point by source file and row", async () => {
    mockCard(gasCard);
    render(<PointCard request={gasRequest} onClose={() => {}} />);
    await screen.findByText(gasCard.title);
    expect(requested).toEqual(["/api/point-card?source_file=PSI-159_Experimental+table_CFI-G_Normal+Flames.csv&source_row=2"]);
  });

  it("asks the API for a report condition by experiment and test id", async () => {
    mockCard(reportCard);
    render(<PointCard request={{ experiment_id: "PSI-20", test_id: report.test_id }} onClose={() => {}} />);
    await screen.findByText(reportCard.title);
    expect(requested).toEqual(["/api/point-card?experiment_id=PSI-20&test_id=19070D1"]);
  });

  it("tells it in plain words: experiment, what was burned, conditions, result", async () => {
    mockCard(gasCard);
    render(<PointCard request={gasRequest} onClose={() => {}} />);
    expect(await screen.findByRole("heading", { name: gasCard.title })).toBeInTheDocument();
    const card = screen.getByRole("region", { name: "Test details" });
    expect(within(card).getByText(gasCard.burned)).toBeInTheDocument();
    expect(within(card).getByText(gasCard.conditions)).toBeInTheDocument();
    expect(within(card).getByText(gasCard.result)).toBeInTheDocument();
  });

  it("keeps the words outside Show the evidence, and the source file and row inside it", async () => {
    mockCard(gasCard);
    render(<PointCard request={gasRequest} onClose={() => {}} />);
    await screen.findByText(gasCard.result);
    expect(screen.getByText(gasCard.result).closest("details")).toBeNull();
    const details = screen.getByText("Show the evidence").closest("details") as HTMLElement;
    expect(details).not.toHaveAttribute("open");
    expect(within(details).getByText(/PSI-159_Experimental table_CFI-G_Normal Flames\.csv, row 2/)).toBeInTheDocument();
    expect(within(details).getByText(/Experiment PSI-159, test 21088A1/)).toBeInTheDocument();
  });

  it("gives the page and figure for a report condition", async () => {
    mockCard(reportCard);
    render(<PointCard request={{ experiment_id: "PSI-20", test_id: "19070D1" }} onClose={() => {}} />);
    await screen.findByText(reportCard.result);
    const details = screen.getByText("Show the evidence").closest("details") as HTMLElement;
    expect(within(details).getByText(/BRE_final_report_20220201\.pdf, page 26, Figure 9/)).toBeInTheDocument();
  });

  it("repeats the pressure note when the pressure came from the record", async () => {
    mockCard(solidCard);
    render(<PointCard request={{ source_file: solidCard.evidence.source_file, source_row: 2 }} onClose={() => {}} />);
    await screen.findByText(solidCard.result);
    const details = screen.getByText("Show the evidence").closest("details") as HTMLElement;
    expect(within(details).getByText("The pressure comes from the experiment record, not the test table.")).toBeInTheDocument();
  });

  it("says it is loading, then shows the card", async () => {
    mockCard(gasCard);
    render(<PointCard request={gasRequest} onClose={() => {}} />);
    expect(screen.getByText("Loading the details...")).toBeInTheDocument();
    await screen.findByText(gasCard.title);
    expect(screen.queryByText("Loading the details...")).toBeNull();
  });

  it("says in plain words when the details could not be loaded, without an alert", async () => {
    mockCard({}, false);
    render(<PointCard request={gasRequest} onClose={() => {}} />);
    expect(await screen.findByText("The details of this test could not be loaded.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("moves focus to the card when it opens", async () => {
    mockCard(gasCard);
    render(<PointCard request={gasRequest} onClose={() => {}} />);
    await screen.findByText(gasCard.title);
    expect(document.activeElement).toBe(screen.getByRole("region", { name: "Test details" }));
  });

  it("closes with the Close button and with Escape", async () => {
    mockCard(gasCard);
    const onClose = vi.fn();
    render(<PointCard request={gasRequest} onClose={onClose} />);
    await screen.findByText(gasCard.title);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole("region", { name: "Test details" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("gives focus back to the mark that opened it when it closes", async () => {
    mockCard(gasCard);
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { unmount } = render(<PointCard request={gasRequest} onClose={() => unmount()} />);
    await screen.findByText(gasCard.title);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
    opener.remove();
  });
});
