export type EtaDocumentType = "i" | "c";

type JsonRecord = Record<string, unknown>;

export interface EtaAddress {
  country: "EG";
  governate: string;
  regionCity: string;
  street: string;
  buildingNumber: string;
  postalCode?: string;
  floor?: string;
  room?: string;
  landmark?: string;
  additionalInformation?: string;
}

export interface EtaFiscalSnapshot {
  documentId: string;
  internalId: string;
  documentType: EtaDocumentType;
  documentTypeVersion: "1.0";
  dateTimeIssued: string;
  taxpayerActivityCode: string;
  issuer: {
    type: "B";
    id: string;
    name: string;
    address: EtaAddress & { branchId: string };
  };
  receiver: {
    type: "B";
    id: string;
    name: string;
    address: EtaAddress;
  };
  references?: string[];
  taxableBaseMinor: string;
  taxMinor: string;
  grossMinor: string;
  lines: Array<{
    description: string;
    itemType: "GS1" | "EGS";
    itemCode: string;
    unitType: string;
    quantity: string;
    unitValueMinor: string;
    salesTotalMinor: string;
    discountMinor: string;
    netTotalMinor: string;
    taxMinor: string;
    internalCode?: string;
  }>;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unsignedIntegerPattern = /^(0|[1-9][0-9]*)$/;
const positiveDecimalPattern = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,5})?$/;

function record(value: unknown, name: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`ETA_DOCUMENT_INVALID: ${name} must be an object`);
  }
  return value as JsonRecord;
}

function textValue(value: unknown, name: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`ETA_DOCUMENT_INVALID: ${name} is required`);
  }
  return value.trim();
}

function minor(value: unknown, name: string, allowZero = false): bigint {
  if (typeof value !== "string" || !unsignedIntegerPattern.test(value)) {
    throw new Error(
      `ETA_DOCUMENT_INVALID: ${name} must be an exact minor-unit string`,
    );
  }
  const parsed = BigInt(value);
  if (allowZero ? parsed < 0n : parsed <= 0n) {
    throw new Error(
      `ETA_DOCUMENT_INVALID: ${name} must be ${
        allowZero ? "non-negative" : "positive"
      }`,
    );
  }
  return parsed;
}

function decimal(value: unknown, name: string): string {
  if (
    typeof value !== "string" || !positiveDecimalPattern.test(value) ||
    /^0(?:\.0+)?$/.test(value)
  ) {
    throw new Error(
      `ETA_DOCUMENT_INVALID: ${name} must be a positive decimal with at most five places`,
    );
  }
  return value;
}

function rawNumber(value: string): unknown {
  const rawJson =
    (JSON as typeof JSON & { rawJSON?: (text: string) => unknown }).rawJSON;
  if (!rawJson) {
    throw new Error(
      "ETA_RUNTIME_INVALID: exact JSON number serialization is unavailable",
    );
  }
  return rawJson(value);
}

function money(minorValue: bigint): unknown {
  const digits = minorValue.toString().padStart(3, "0");
  return rawNumber(`${digits.slice(0, -2)}.${digits.slice(-2)}`);
}

function parseAddress(
  value: unknown,
  name: string,
  issuer: boolean,
): JsonRecord {
  const address = record(value, name);
  if (address.country !== "EG") {
    throw new Error(`ETA_DOCUMENT_INVALID: ${name}.country must be EG`);
  }
  const result: JsonRecord = {
    country: "EG",
    governate: textValue(address.governate, `${name}.governate`),
    regionCity: textValue(address.regionCity, `${name}.regionCity`),
    street: textValue(address.street, `${name}.street`),
    buildingNumber: textValue(address.buildingNumber, `${name}.buildingNumber`),
  };
  if (issuer) {
    result.branchId = textValue(address.branchId, `${name}.branchId`, 50);
  }
  for (
    const optional of [
      "postalCode",
      "floor",
      "room",
      "landmark",
      "additionalInformation",
    ]
  ) {
    if (address[optional] != null && address[optional] !== "") {
      result[optional] = textValue(address[optional], `${name}.${optional}`);
    }
  }
  return result;
}

/**
 * Maps an immutable Ledger fiscal snapshot to the ETA v1.0 JSON document.
 * All accounting totals are reconciled as BigInt before any JSON decimal is made.
 */
export function buildEtaDocument(value: unknown): JsonRecord {
  const snapshot = record(value, "snapshot");
  const documentId = textValue(snapshot.documentId, "documentId");
  if (!uuidPattern.test(documentId)) {
    throw new Error("ETA_DOCUMENT_INVALID: documentId must be a UUID");
  }
  const documentType = snapshot.documentType;
  if (documentType !== "i" && documentType !== "c") {
    throw new Error(
      "ETA_DOCUMENT_INVALID: only domestic invoice and credit note are supported",
    );
  }
  if (snapshot.documentTypeVersion !== "1.0") {
    throw new Error(
      "ETA_DOCUMENT_INVALID: only ETA document version 1.0 is supported",
    );
  }
  const issued = textValue(snapshot.dateTimeIssued, "dateTimeIssued");
  const issuedDate = new Date(issued);
  if (
    !Number.isFinite(issuedDate.valueOf()) ||
    issuedDate.toISOString() !== issued || issuedDate.valueOf() > Date.now()
  ) {
    throw new Error(
      "ETA_DOCUMENT_INVALID: dateTimeIssued must be a non-future UTC instant",
    );
  }

  const issuer = record(snapshot.issuer, "issuer");
  const receiver = record(snapshot.receiver, "receiver");
  if (issuer.type !== "B" || receiver.type !== "B") {
    throw new Error(
      "ETA_DOCUMENT_INVALID: this adapter supports Egyptian B2B parties only",
    );
  }
  const issuerId = textValue(issuer.id, "issuer.id", 64);
  const receiverId = textValue(receiver.id, "receiver.id", 64);
  if (issuerId === receiverId) {
    throw new Error("ETA_DOCUMENT_INVALID: issuer and receiver must differ");
  }

  const base = minor(snapshot.taxableBaseMinor, "taxableBaseMinor");
  const tax = minor(snapshot.taxMinor, "taxMinor");
  const gross = minor(snapshot.grossMinor, "grossMinor");
  if (base + tax !== gross) {
    throw new Error("ETA_DOCUMENT_INVALID: source gross does not reconcile");
  }
  if (!Array.isArray(snapshot.lines) || snapshot.lines.length === 0) {
    throw new Error(
      "ETA_DOCUMENT_INVALID: complete fiscal line items are required",
    );
  }

  let lineSales = 0n;
  let lineDiscount = 0n;
  let lineNet = 0n;
  let lineTax = 0n;
  const invoiceLines = snapshot.lines.map((rawLine, index) => {
    const line = record(rawLine, `lines[${index}]`);
    if (line.itemType !== "GS1" && line.itemType !== "EGS") {
      throw new Error(
        `ETA_DOCUMENT_INVALID: lines[${index}].itemType must be GS1 or EGS`,
      );
    }
    const quantity = decimal(line.quantity, `lines[${index}].quantity`);
    const unitValue = minor(
      line.unitValueMinor,
      `lines[${index}].unitValueMinor`,
    );
    const sales = minor(
      line.salesTotalMinor,
      `lines[${index}].salesTotalMinor`,
    );
    const discount = minor(
      line.discountMinor,
      `lines[${index}].discountMinor`,
      true,
    );
    const net = minor(line.netTotalMinor, `lines[${index}].netTotalMinor`);
    const lineVat = minor(line.taxMinor, `lines[${index}].taxMinor`);
    if (sales - discount !== net) {
      throw new Error(
        `ETA_DOCUMENT_INVALID: lines[${index}] sales, discount and net do not reconcile`,
      );
    }
    lineSales += sales;
    lineDiscount += discount;
    lineNet += net;
    lineTax += lineVat;
    const result: JsonRecord = {
      description: textValue(line.description, `lines[${index}].description`),
      itemType: line.itemType,
      itemCode: textValue(line.itemCode, `lines[${index}].itemCode`, 100),
      unitType: textValue(line.unitType, `lines[${index}].unitType`, 30),
      quantity: rawNumber(quantity),
      unitValue: { currencySold: "EGP", amountEGP: money(unitValue) },
      salesTotal: money(sales),
      total: money(net + lineVat),
      valueDifference: 0,
      totalTaxableFees: 0,
      netTotal: money(net),
      itemsDiscount: 0,
      taxableItems: [{
        taxType: "T1",
        amount: money(lineVat),
        subType: "V009",
        rate: 14,
      }],
    };
    if (discount > 0n) result.discount = { amount: money(discount) };
    if (line.internalCode != null && line.internalCode !== "") {
      result.internalCode = textValue(
        line.internalCode,
        `lines[${index}].internalCode`,
        100,
      );
    }
    return result;
  });
  if (lineNet !== base || lineTax !== tax || lineNet + lineTax !== gross) {
    throw new Error(
      "ETA_DOCUMENT_INVALID: fiscal lines do not reconcile to immutable VAT amounts",
    );
  }

  const result: JsonRecord = {
    issuer: {
      type: "B",
      id: issuerId,
      name: textValue(issuer.name, "issuer.name"),
      address: parseAddress(issuer.address, "issuer.address", true),
    },
    receiver: {
      type: "B",
      id: receiverId,
      name: textValue(receiver.name, "receiver.name"),
      address: parseAddress(receiver.address, "receiver.address", false),
    },
    documentType,
    documentTypeVersion: "1.0",
    dateTimeIssued: issued,
    taxpayerActivityCode: textValue(
      snapshot.taxpayerActivityCode,
      "taxpayerActivityCode",
      20,
    ),
    internalId: textValue(snapshot.internalId, "internalId", 50),
    invoiceLines,
    totalSalesAmount: money(lineSales),
    totalDiscountAmount: money(lineDiscount),
    netAmount: money(base),
    taxTotals: [{ taxType: "T1", amount: money(tax) }],
    extraDiscountAmount: 0,
    totalItemsDiscountAmount: 0,
    totalAmount: money(gross),
  };
  if (documentType === "c") {
    if (
      !Array.isArray(snapshot.references) || snapshot.references.length !== 1
    ) {
      throw new Error(
        "ETA_DOCUMENT_INVALID: a credit note requires one accepted ETA invoice reference",
      );
    }
    result.references = [
      textValue(snapshot.references[0], "references[0]", 64),
    ];
  }
  return result;
}

export function parseEtaAction(
  value: unknown,
): { action: "submit" | "poll"; organizationId: string; documentId: string } {
  const body = record(value, "request");
  if (body.action !== "submit" && body.action !== "poll") {
    throw new Error("Invalid ETA action");
  }
  const organizationId = textValue(body.organizationId, "organizationId");
  const documentId = textValue(body.documentId, "documentId");
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(documentId)) {
    throw new Error("Invalid ETA request identifiers");
  }
  return { action: body.action, organizationId, documentId };
}
