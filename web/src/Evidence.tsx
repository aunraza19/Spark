import type { ReactNode } from "react";

export function Evidence({ children }: { children: ReactNode }) {
  return (
    <details className="evidence">
      <summary>Show the evidence</summary>
      {children}
    </details>
  );
}
