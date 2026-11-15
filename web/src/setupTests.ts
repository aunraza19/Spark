import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no canvas. Return no context so drawing code stays quiet in tests.
vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => null);

// jsdom does not scroll. Pages scroll to the top when the address changes.
window.scrollTo = vi.fn();

// The styled chat panel is heavier to render. Under a full parallel run one second is not always enough.
configure({ asyncUtilTimeout: 5000 });

afterEach(cleanup);
