import { useEffect, useState } from "react";

export type Route = { kind: "home" } | { kind: "experiments" } | { kind: "experiment"; id: string };

export const experimentHref = (id: string) => `#experiment/${id}`;

export function parseRoute(hash: string): Route {
  const [kind, id] = hash.replace(/^#/, "").split("/");
  if (kind === "experiments") return { kind: "experiments" };
  if (kind === "experiment" && id) return { kind: "experiment", id: decodeURIComponent(id) };
  return { kind: "home" };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return parseRoute(hash);
}
