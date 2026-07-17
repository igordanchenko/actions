// Reads `size-limit --json` output on stdin and prints the byte count of the
// entry named by $ENTRY.
const data = JSON.parse(require("node:fs").readFileSync(0, "utf8"));

// size-limit reports each entry under its `name`, which defaults to `path` when
// unset, so matching on `name` covers both the `path` default and an explicit
// `name`.
const entry = data.find((e) => e.name === process.env.ENTRY);
if (!entry || typeof entry.size !== "number") {
  const names = data.map((e) => `"${e.name}"`).join(", ") || "none";
  console.error(
    `::error::bundle-size: no size-limit entry matching "${process.env.ENTRY}" (available: ${names})`,
  );
  process.exit(1);
}

process.stdout.write(String(entry.size));
