// Formats a byte count (first argument) with an adaptive unit (decimal,
// base-1000) and 3 significant digits: "747 B", "1.07 kB", "10.7 kB", "748 kB",
// "1.24 MB". The kB value is rounded before the unit check so 999.7 kB rolls
// over to "1 MB", not "1000 kB".
function round3(n) {
  return Number(n.toPrecision(3));
}

const bytes = Number(process.argv[2]);
const kb = round3(bytes / 1e3);

process.stdout.write(bytes < 1000 ? `${bytes} B` : kb < 1000 ? `${kb} kB` : `${round3(bytes / 1e6)} MB`);
