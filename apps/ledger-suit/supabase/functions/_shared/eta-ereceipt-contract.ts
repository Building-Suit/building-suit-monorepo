type JsonRecord = Record<string, unknown>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const receiptUuidPattern = /^[0-9a-f]{64}$/i;
const unsignedIntegerPattern = /^(0|[1-9][0-9]*)$/;
const positiveDecimalPattern = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,5})?$/;

function record(value: unknown, name: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`ETA_ERECEIPT_INVALID: ${name} must be an object`);
  }
  return value as JsonRecord;
}

function textValue(value: unknown, name: string, max = 200): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`ETA_ERECEIPT_INVALID: ${name} is required`);
  }
  return value.trim();
}

function minor(value: unknown, name: string, allowZero = false): bigint {
  if (typeof value !== "string" || !unsignedIntegerPattern.test(value)) {
    throw new Error(
      `ETA_ERECEIPT_INVALID: ${name} must be an exact minor-unit string`,
    );
  }
  const parsed = BigInt(value);
  if (allowZero ? parsed < 0n : parsed <= 0n) {
    throw new Error(`ETA_ERECEIPT_INVALID: ${name} has an invalid value`);
  }
  return parsed;
}

function decimal(value: unknown, name: string): string {
  if (
    typeof value !== "string" || !positiveDecimalPattern.test(value) ||
    /^0(?:\.0+)?$/.test(value)
  ) {
    throw new Error(
      `ETA_ERECEIPT_INVALID: ${name} must be a positive decimal with at most five places`,
    );
  }
  return value;
}

function rawNumber(value: string): unknown {
  const rawJson =
    (JSON as typeof JSON & { rawJSON?: (text: string) => unknown }).rawJSON;
  if (!rawJson) {
    throw new Error(
      "ETA_ERECEIPT_RUNTIME_INVALID: exact JSON number serialization is unavailable",
    );
  }
  return rawJson(value);
}

function money(value: bigint): unknown {
  const digits = value.toString().padStart(3, "0");
  return rawNumber(`${digits.slice(0, -2)}.${digits.slice(-2)}`);
}

function roundedQuantityMinor(quantity: string, unitMinor: bigint): bigint {
  const [whole, fraction = ""] = quantity.split(".");
  const scale = 10n ** BigInt(fraction.length);
  const scaledQuantity = BigInt(whole) * scale + BigInt(fraction || "0");
  return (scaledQuantity * unitMinor + scale / 2n) / scale;
}

function parseAddress(value: unknown): JsonRecord {
  const address = record(value, "seller.address");
  if (address.country !== "EG") {
    throw new Error("ETA_ERECEIPT_INVALID: seller.address.country must be EG");
  }
  const result: JsonRecord = {
    country: "EG",
    governate: textValue(address.governate, "seller.address.governate"),
    regionCity: textValue(address.regionCity, "seller.address.regionCity"),
    street: textValue(address.street, "seller.address.street"),
    buildingNumber: textValue(
      address.buildingNumber,
      "seller.address.buildingNumber",
    ),
  };
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
      result[optional] = textValue(
        address[optional],
        `seller.address.${optional}`,
      );
    }
  }
  return result;
}

/** Maps one immutable Ledger source snapshot to the official receipt v1.2 shape. */
export function buildEtaReceipt(value: unknown): JsonRecord {
  const snapshot = record(value, "snapshot");
  if (!uuidPattern.test(textValue(snapshot.documentId, "documentId"))) {
    throw new Error("ETA_ERECEIPT_INVALID: documentId must be a UUID");
  }
  if (
    (snapshot.receiptType !== "s" && snapshot.receiptType !== "r") ||
    snapshot.typeVersion !== "1.2"
  ) {
    throw new Error(
      "ETA_ERECEIPT_INVALID: only sale and referenced return receipt v1.2 are supported",
    );
  }
  const issued = textValue(snapshot.dateTimeIssued, "dateTimeIssued");
  const issuedDate = new Date(issued);
  if (
    !Number.isFinite(issuedDate.valueOf()) ||
    issuedDate.toISOString() !== issued || issuedDate.valueOf() > Date.now()
  ) {
    throw new Error(
      "ETA_ERECEIPT_INVALID: dateTimeIssued must be a non-future UTC instant",
    );
  }
  const previousUuid = snapshot.previousUUID;
  if (
    typeof previousUuid !== "string" ||
    (previousUuid !== "" && !receiptUuidPattern.test(previousUuid))
  ) {
    throw new Error("ETA_ERECEIPT_INVALID: previousUUID is invalid");
  }
  const referenceUuid = snapshot.referenceUUID;
  if (
    snapshot.receiptType === "r" &&
    (typeof referenceUuid !== "string" ||
      !receiptUuidPattern.test(referenceUuid))
  ) {
    throw new Error(
      "ETA_ERECEIPT_INVALID: a return requires the valid sale receipt UUID",
    );
  }

  const seller = record(snapshot.seller, "seller");
  const buyer = record(snapshot.buyer, "buyer");
  if (!["B", "P", "F"].includes(String(buyer.type))) {
    throw new Error("ETA_ERECEIPT_INVALID: buyer.type must be B, P or F");
  }
  const base = minor(snapshot.taxableBaseMinor, "taxableBaseMinor");
  const tax = minor(snapshot.taxMinor, "taxMinor");
  const gross = minor(snapshot.grossMinor, "grossMinor");
  if (base + tax !== gross) {
    throw new Error("ETA_ERECEIPT_INVALID: source gross does not reconcile");
  }
  if (
    !Array.isArray(snapshot.lines) || snapshot.lines.length === 0 ||
    snapshot.lines.length > 300
  ) {
    throw new Error(
      "ETA_ERECEIPT_SOURCE_REQUIRED: 1 to 300 authoritative coded receipt lines are required",
    );
  }

  let salesTotal = 0n;
  let discountTotal = 0n;
  let netTotal = 0n;
  let taxTotal = 0n;
  const itemData = snapshot.lines.map((raw, index) => {
    const line = record(raw, `lines[${index}]`);
    if (line.itemType !== "GS1" && line.itemType !== "EGS") {
      throw new Error(
        `ETA_ERECEIPT_INVALID: lines[${index}].itemType must be GS1 or EGS`,
      );
    }
    const quantity = decimal(line.quantity, `lines[${index}].quantity`);
    const unitPrice = minor(
      line.unitPriceMinor,
      `lines[${index}].unitPriceMinor`,
    );
    const sales = minor(line.totalSaleMinor, `lines[${index}].totalSaleMinor`);
    const discount = minor(
      line.discountMinor,
      `lines[${index}].discountMinor`,
      true,
    );
    const net = minor(line.netSaleMinor, `lines[${index}].netSaleMinor`);
    const lineTax = minor(line.taxMinor, `lines[${index}].taxMinor`);
    if (sales - discount !== net) {
      throw new Error(
        `ETA_ERECEIPT_INVALID: lines[${index}] sales, discount and net do not reconcile`,
      );
    }
    if (roundedQuantityMinor(quantity, unitPrice) !== sales) {
      throw new Error(
        `ETA_ERECEIPT_INVALID: lines[${index}] quantity and unit price do not equal total sale`,
      );
    }
    if ((net * 14n + 50n) / 100n !== lineTax) {
      throw new Error(
        `ETA_ERECEIPT_INVALID: lines[${index}] VAT is not the approved 14% amount`,
      );
    }
    salesTotal += sales;
    discountTotal += discount;
    netTotal += net;
    taxTotal += lineTax;
    const item: JsonRecord = {
      internalCode: textValue(
        line.internalCode,
        `lines[${index}].internalCode`,
        50,
      ),
      description: textValue(
        line.description,
        `lines[${index}].description`,
        500,
      ),
      itemType: line.itemType,
      itemCode: textValue(line.itemCode, `lines[${index}].itemCode`, 100),
      unitType: textValue(line.unitType, `lines[${index}].unitType`, 30),
      quantity: rawNumber(quantity),
      unitPrice: money(unitPrice),
      netSale: money(net),
      totalSale: money(sales),
      total: money(net + lineTax),
      taxableItems: [{
        taxType: "T1",
        amount: money(lineTax),
        subType: "V009",
        rate: 14,
      }],
    };
    if (discount > 0n) {
      item.commercialDiscountData = [{
        amount: money(discount),
        description: "Source discount",
      }];
    }
    return item;
  });
  if (netTotal !== base || taxTotal !== tax || netTotal + taxTotal !== gross) {
    throw new Error(
      "ETA_ERECEIPT_INVALID: receipt lines do not reconcile to immutable VAT amounts",
    );
  }

  const header: JsonRecord = {
    dateTimeIssued: issued,
    receiptNumber: textValue(snapshot.receiptNumber, "receiptNumber", 50),
    uuid: "",
    previousUUID: previousUuid,
    currency: "EGP",
  };
  if (snapshot.receiptType === "r") header.referenceUUID = referenceUuid;
  if (
    typeof snapshot.referenceOldUUID === "string" && snapshot.referenceOldUUID
  ) {
    if (!receiptUuidPattern.test(snapshot.referenceOldUUID)) {
      throw new Error("ETA_ERECEIPT_INVALID: referenceOldUUID is invalid");
    }
    header.referenceOldUUID = snapshot.referenceOldUUID;
  }
  const buyerResult: JsonRecord = {
    type: buyer.type,
    id: textValue(buyer.id, "buyer.id", 30),
    name: textValue(buyer.name, "buyer.name", 100),
  };
  return {
    header,
    documentType: { receiptType: snapshot.receiptType, typeVersion: "1.2" },
    seller: {
      rin: textValue(seller.rin, "seller.rin", 30),
      companyTradeName: textValue(
        seller.companyTradeName,
        "seller.companyTradeName",
      ),
      branchCode: textValue(seller.branchCode, "seller.branchCode", 50),
      branchAddress: parseAddress(seller.branchAddress),
      deviceSerialNumber: textValue(
        seller.deviceSerialNumber,
        "seller.deviceSerialNumber",
        100,
      ),
      activityCode: textValue(seller.activityCode, "seller.activityCode", 10),
    },
    buyer: buyerResult,
    itemData,
    totalSales: money(salesTotal),
    totalCommercialDiscount: money(discountTotal),
    totalItemsDiscount: rawNumber("0.00"),
    netAmount: money(base),
    feesAmount: rawNumber("0.00"),
    totalAmount: money(gross),
    taxTotals: [{ taxType: "T1", amount: money(tax) }],
    paymentMethod: textValue(snapshot.paymentMethod, "paymentMethod", 50),
    adjustment: rawNumber("0.00"),
  };
}

function rawJsonText(value: unknown): string | null {
  const jsonApi = JSON as typeof JSON & {
    isRawJSON?: (candidate: unknown) => boolean;
  };
  if (jsonApi.isRawJSON?.(value)) {
    return (value as { rawJSON: string }).rawJSON;
  }
  return null;
}

/** ETA's culture-invariant, order-preserving canonical serialization. */
export function serializeEtaReceipt(value: unknown): string {
  const raw = rawJsonText(value);
  if (raw != null) return `"${raw}"`;
  if (value === null || typeof value !== "object") {
    return JSON.stringify(String(value));
  }
  if (Array.isArray(value)) {
    throw new Error("ETA_ERECEIPT_INVALID: root arrays are not serializable");
  }
  let result = "";
  for (const [name, child] of Object.entries(value as JsonRecord)) {
    const upper = name.toUpperCase();
    result += `"${upper}"`;
    if (Array.isArray(child)) {
      for (const item of child) {
        result += `"${upper}"${serializeEtaReceipt(item)}`;
      }
    } else {
      result += serializeEtaReceipt(child);
    }
  }
  return result;
}

export async function assignEtaReceiptUuid(
  receipt: JsonRecord,
): Promise<JsonRecord> {
  const header = record(receipt.header, "header");
  if (header.uuid !== "") {
    throw new Error("ETA_ERECEIPT_INVALID: UUID must be empty before hashing");
  }
  const bytes = new TextEncoder().encode(serializeEtaReceipt(receipt));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const uuid = [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return { ...receipt, header: { ...header, uuid } };
}

export function parseEtaReceiptAction(
  value: unknown,
): { action: "submit" | "poll"; organizationId: string; documentId: string } {
  const body = record(value, "request");
  if (body.action !== "submit" && body.action !== "poll") {
    throw new Error("Invalid ETA eReceipt action");
  }
  const organizationId = textValue(body.organizationId, "organizationId");
  const documentId = textValue(body.documentId, "documentId");
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(documentId)) {
    throw new Error("Invalid ETA eReceipt request identifiers");
  }
  return { action: body.action, organizationId, documentId };
}
