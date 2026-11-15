import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no canvas. Return no context so drawing code stays quiet in tests.
vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);

// jsdom does not scroll. Pages scroll to the top when the address changes.
window.scrollTo = vi.fn();

afterEach(cleanup);
