import { LEDE } from "./content";
import { FlameDrop } from "./FlameDrop";

export function Hero() {
  return (
    <header className="hero">
      <div className="hero-copy">
        <h1>Flame in Freefall</h1>
        <p className="lede">{LEDE}</p>
      </div>
      <FlameDrop />
    </header>
  );
}
