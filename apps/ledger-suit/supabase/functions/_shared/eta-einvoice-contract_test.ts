// deno-lint-ignore-file no-import-prefix
import { assertEquals, assertThrows } from "jsr:@std/assert@1";
import { buildEtaDocument, parseEtaAction } from "./eta-einvoice-contract.ts";

const snapshot = {
  documentId: "10000000-0000-4000-8000-000000000001",
  internalId: "INV-2026-0001",
  documentType: "i",
  documentTypeVersion: "1.0",
  dateTimeIssued: "2026-09-27T10:00:00.000Z",
  taxpayerActivityCode: "6201",
  issuer: {
    type: "B",
    id: "123456789",
    name: "Ledger Fixture Issuer",
    address: {
      branchId: "0",
      country: "EG",
      governate: "Cairo",
      regionCity: "Cairo",
      street: "Fixture Street",
      buildingNumber: "1",
    },
  },
  receiver: {
    type: "B",
    id: "987654321",
    name: "Fixture Receiver",
    address: {
      country: "EG",
      governate: "Giza",
      regionCity: "Dokki",
      street: "Receiver Street",
      buildingNumber: "2",
    },
  },
  taxableBaseMinor: "10000000000000001",
  taxMinor: "1400000000000000",
  grossMinor: "11400000000000001",
  lines: [{
    description: "Configured service",
    itemType: "EGS",
    itemCode: "EG-100000000-1",
    unitType: "C62",
    quantity: "1.00000",
    unitValueMinor: "10000000000000001",
    salesTotalMinor: "10000000000000001",
    discountMinor: "0",
    netTotalMinor: "10000000000000001",
    taxMinor: "1400000000000000",
    internalCode: "SERVICE-1",
  }],
};

Deno.test("ETA mapping preserves large exact minor amounts through JSON", () => {
  const document = buildEtaDocument(snapshot);
  const serialized = JSON.stringify(document);
  assertEquals(serialized.includes('"netAmount":100000000000000.01'), true);
  assertEquals(serialized.includes('"totalAmount":114000000000000.01'), true);
  assertEquals(serialized.includes('"taxType":"T1"'), true);
  assertEquals(serialized.includes('"subType":"V009"'), true);
  assertEquals("signatures" in document, false);
});

Deno.test("ETA mapping refuses aggregate-only or mismatched accounting sources", () => {
  assertThrows(
    () => buildEtaDocument({ ...snapshot, lines: [] }),
    Error,
    "complete fiscal line items",
  );
  assertThrows(
    () => buildEtaDocument({ ...snapshot, taxMinor: "1399999999999999" }),
    Error,
    "source gross does not reconcile",
  );
  assertThrows(
    () =>
      buildEtaDocument({
        ...snapshot,
        lines: [{ ...snapshot.lines[0], netTotalMinor: "1" }],
      }),
    Error,
    "sales, discount and net do not reconcile",
  );
});

Deno.test("ETA credit notes require an accepted invoice UUID reference", () => {
  assertThrows(
    () => buildEtaDocument({ ...snapshot, documentType: "c" }),
    Error,
    "requires one accepted ETA invoice reference",
  );
  const document = buildEtaDocument({
    ...snapshot,
    documentType: "c",
    references: ["ETA-INVOICE-UUID"],
  });
  assertEquals(document.references, ["ETA-INVOICE-UUID"]);
});

Deno.test("ETA commands accept only explicit submit and poll actions", () => {
  const expected = {
    action: "submit" as const,
    organizationId: "20000000-0000-4000-8000-000000000001",
    documentId: "10000000-0000-4000-8000-000000000001",
  };
  assertEquals(parseEtaAction(expected), expected);
  assertThrows(
    () => parseEtaAction({ ...expected, action: "cancel" }),
    Error,
    "Invalid ETA action",
  );
});
