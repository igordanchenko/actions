const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const SCRIPT = path.join(__dirname, "extract.js");

// Runs extract.js with `data` as the size-limit JSON on stdin and `entry` as
// $ENTRY, returning the exit status and both output streams.
function run(data, entry) {
  return spawnSync(process.execPath, [SCRIPT], {
    input: JSON.stringify(data),
    env: { ...process.env, ENTRY: entry },
    encoding: "utf8",
  });
}

describe("bundle-size/extract.js", () => {
  test("selects the entry by name and prints its byte count", () => {
    const { status, stdout } = run(
      [
        { name: "dist/index.js", size: 12345 },
        { name: "CSS", size: 678 },
      ],
      "dist/index.js",
    );

    assert.equal(status, 0);
    assert.equal(stdout, "12345");
  });

  test("matches an explicit entry name", () => {
    const { status, stdout } = run([{ name: "CSS", size: 678 }], "CSS");

    assert.equal(status, 0);
    assert.equal(stdout, "678");
  });

  test("fails with an error annotation listing available entries when none match", () => {
    const { status, stdout, stderr } = run(
      [
        { name: "dist/index.js", size: 1 },
        { name: "CSS", size: 2 },
      ],
      "dist/main.js",
    );

    assert.equal(status, 1);
    assert.equal(stdout, "");
    // `includes` rather than exact equality, so an incidental Node warning on
    // stderr (e.g. after an LTS rollover in CI) cannot fail the assertion.
    assert.ok(
      stderr.includes(
        '::error::bundle-size: no size-limit entry matching "dist/main.js" (available: "dist/index.js", "CSS")',
      ),
    );
  });

  test("reports none available for an empty entry list", () => {
    const { status, stderr } = run([], "dist/index.js");

    assert.equal(status, 1);
    assert.match(stderr, /\(available: none\)/);
  });

  test("rejects a matching entry without a numeric size", () => {
    const { status, stderr } = run([{ name: "dist/index.js", size: "12345" }], "dist/index.js");

    assert.equal(status, 1);
    assert.match(stderr, /no size-limit entry matching "dist\/index\.js"/);
  });
});
