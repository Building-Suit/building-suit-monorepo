// deno-lint-ignore-file no-import-prefix
import { assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import {
  assignEtaReceiptUuid,
  buildEtaReceipt,
  parseEtaReceiptAction,
  serializeEtaReceipt,
} from "./eta-ereceipt-contract.ts";

const snapshot = {
  documentId: "10000000-0000-4000-8000-000000000001",
  receiptType: "s",
  typeVersion: "1.2",
  receiptNumber: "RECEIPT-1",
  dateTimeIssued: "2026-09-26T10:00:00.000Z",
  previousUUID: "",
  seller: {
    rin: "123456789",
    companyTradeName: "Ledger Fixture Issuer",
    branchCode: "0",
    deviceSerialNumber: "POS-1",
    activityCode: "6201",
    branchAddress: {
      country: "EG",
      governate: "Cairo",
      regionCity: "Cairo",
      street: "Fixture Street",
      buildingNumber: "1",
    },
  },
  buyer: { type: "P", id: "29901011234567", name: "Fixture Buyer" },
  paymentMethod: "C",
  taxableBaseMinor: "10000000000000001",
  taxMinor: "1400000000000000",
  grossMinor: "11400000000000001",
  lines: [{
    internalCode: "SERVICE-1",
    description: "Configured service",
    itemType: "EGS",
    itemCode: "EG-100000000-1",
    unitType: "C62",
    quantity: "1.00000",
    unitPriceMinor: "10000000000000001",
    totalSaleMinor: "10000000000000001",
    discountMinor: "0",
    netSaleMinor: "10000000000000001",
    taxMinor: "1400000000000000",
  }],
};

Deno.test("eReceipt v1.2 preserves exact money and uses receipt-specific fields", () => {
  const receipt = buildEtaReceipt(snapshot);
  const serialized = JSON.stringify(receipt);
  assertEquals(serialized.includes('"typeVersion":"1.2"'), true);
  assertEquals(serialized.includes('"netAmount":100000000000000.01'), true);
  assertEquals(serialized.includes('"signatureType"'), false);
  assertEquals((receipt.header as Record<string, unknown>).uuid, "");
});

Deno.test("receipt UUID uses the ETA canonical receipt serialization", async () => {
  const receipt = buildEtaReceipt(snapshot);
  const canonical = serializeEtaReceipt(receipt);
  assertEquals(canonical.startsWith('"HEADER""DATETIMEISSUED"'), true);
  const assigned = await assignEtaReceiptUuid(receipt);
  const uuid = (assigned.header as Record<string, unknown>).uuid;
  assertEquals(typeof uuid, "string");
  assertEquals((uuid as string).length, 64);
  await assertRejects(
    () => assignEtaReceiptUuid(assigned),
    Error,
    "UUID must be empty",
  );
});

Deno.test("return and source prerequisites fail closed", () => {
  assertThrows(
    () => buildEtaReceipt({ ...snapshot, lines: [] }),
    Error,
    "authoritative coded receipt lines are required",
  );
  assertThrows(
    () => buildEtaReceipt({ ...snapshot, receiptType: "r" }),
    Error,
    "valid sale receipt UUID",
  );
  assertThrows(
    () => buildEtaReceipt({ ...snapshot, taxMinor: "1399999999999999" }),
    Error,
    "source gross does not reconcile",
  );
});

Deno.test("eReceipt commands allow only submit and poll", () => {
  const expected = {
    action: "submit" as const,
    organizationId: "20000000-0000-4000-8000-000000000001",
    documentId: "10000000-0000-4000-8000-000000000001",
  };
  assertEquals(parseEtaReceiptAction(expected), expected);
  assertThrows(
    () => parseEtaReceiptAction({ ...expected, action: "cancel" }),
    Error,
    "Invalid ETA eReceipt action",
  );
});
