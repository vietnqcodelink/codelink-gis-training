import { useEffect, useState } from "react";

type BuildInfo = {
  commit: string;
  builtAt: string;
};

export function BuildVersion() {
  const [build, setBuild] = useState<BuildInfo | null>(null);

  useEffect(() => {
    fetch("/build-info.json", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<BuildInfo> : null)
      .then((data) => {
        if (data?.commit) setBuild(data);
      })
      .catch(() => {});
  }, []);

  if (!build) return null;

  const shortCommit = build.commit === "unknown" ? "unknown" : build.commit.slice(0, 7);

  return (
    <a
      className="build-version"
      href="/build-info.json"
      title={`Commit: ${build.commit}\nBuilt: ${build.builtAt}`}
      target="_blank"
      rel="noreferrer">
      Build {shortCommit}
    </a>
  );
}
