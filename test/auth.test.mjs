import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isAllowedPhone, toE164 } from "../server/session.mjs";

describe("SMS login allowlist", () => {
  it("normalizes US numbers to E.164", () => {
    assert.equal(toE164("5095727660"), "+15095727660");
    assert.equal(toE164("15095727660"), "+15095727660");
    assert.equal(toE164("+1 (509) 572-7660"), "+15095727660");
  });

  it("allows only the owner phone by default", () => {
    assert.equal(isAllowedPhone("5095727660"), true);
    assert.equal(isAllowedPhone("5099199471"), false);
    assert.equal(isAllowedPhone("5090000000"), false);
  });
});
