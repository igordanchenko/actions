const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "format.js");

function run(bytes) {
  return spawnSync(process.execPath, [SCRIPT, String(bytes)], { encoding: "utf8" });
}

describe("bundle-size/format.js", () => {
  test("formats with adaptive units and 3 significant digits", () => {
    const cases = [
      [0, "0 B"],
      [747, "747 B"],
      [999, "999 B"],
      [1000, "1 kB"],
      [1074, "1.07 kB"],
      [10740, "10.7 kB"],
      [747900, "748 kB"],
      [999400, "999 kB"],
      [999700, "1 MB"], // rounds to 1000 kB, so the unit rolls over
      [1240000, "1.24 MB"],
      [12400000, "12.4 MB"],
    ];

    for (const [bytes, expected] of cases) {
      const { status, stdout } = run(bytes);
      assert.equal(status, 0);
      assert.equal(stdout, expected, `${bytes} bytes`);
    }
  });
});
