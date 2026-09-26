import { test } from "node:test";
import assert from "node:assert/strict";
import { assertOwnership } from "../src/controllers/supportCaseController.js";

// Regression test: GET /api/cases/:id populates complainantId BEFORE the
// ownership check, so assertOwnership must handle both raw ObjectIds and
// populated Patient documents. The old `.toString()` comparison failed on
// populated docs and returned 403 for the case owner.

const OWNER_ID = "68d000000000000000000001";

const rawObjectId = {
  toString: () => OWNER_ID,
};

const populatedDoc = {
  _id: { toString: () => OWNER_ID },
  name: "Meena Rathore",
  toString: () => "[object Object]",
};

test("ownership passes with a raw ObjectId complainantId", () => {
  assert.equal(
    assertOwnership({ complainantId: rawObjectId }, OWNER_ID),
    true,
  );
});

test("ownership passes with a populated complainant document", () => {
  assert.equal(
    assertOwnership({ complainantId: populatedDoc }, OWNER_ID),
    true,
  );
});

test("ownership fails for a different user", () => {
  assert.equal(
    assertOwnership({ complainantId: rawObjectId }, "68d000000000000000000002"),
    false,
  );
  assert.equal(
    assertOwnership(
      { complainantId: populatedDoc },
      "68d000000000000000000002",
    ),
    false,
  );
});
