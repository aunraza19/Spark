import { useEffect, useState } from "react";
import { fetchAbout, type About } from "./api";
import { AboutFooter } from "./AboutFooter";

export function AboutFooterLoader() {
  const [about, setAbout] = useState<About | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchAbout()
      .then(setAbout)
      .catch(() => setFailed(true));
  }, []);

  return <AboutFooter about={about} failed={failed} />;
}
