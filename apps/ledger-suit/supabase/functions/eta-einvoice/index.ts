import {
  adminClient,
  authenticatedClient,
  handleOptions,
  json,
  readJson,
  requiredEnv,
} from "../_shared/http.ts";
import {
  buildEtaDocument,
  parseEtaAction,
} from "../_shared/eta-einvoice-contract.ts";
import {
  EtaTransportError,
  pollEtaSubmission,
  signEtaDocument,
  submitEtaDocument,
} from "../_shared/eta-einvoice.ts";

type JsonRecord = Record<string, unknown>;

function firstRecord(value: unknown): JsonRecord | null {
  return Array.isArray(value) && value[0] && typeof value[0] === "object"
    ? value[0] as JsonRecord
    : null;
}

function errorDetails(value: unknown): { code: string; message: string } {
  if (!value || typeof value !== "object") {
    return { code: "ETA_REJECTED", message: "ETA rejected the document" };
  }
  const error = value as JsonRecord;
  return {
    code: typeof error.code === "string" ? error.code : "ETA_REJECTED",
    message: typeof error.message === "string"
      ? error.message
      : "ETA rejected the document",
  };
}

async function recordResult(args: JsonRecord): Promise<void> {
  const { error } = await adminClient().rpc(
    "record_eta_preproduction_result",
    args,
  );
  if (error) throw error;
}

function publicMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "ETA request failed";
  if (
    message.startsWith("Missing server secret:") ||
    message.includes("ETA_SIGNER")
  ) {
    return "ETA preproduction server credentials or signing are not configured.";
  }
  return message.slice(0, 1000);
}

Deno.serve(async (request) => {
  const preflight = handleOptions(request);
  if (preflight) return preflight;

  let organizationId: string | null = null;
  let documentId: string | null = null;
  let mayRecordResult = false;
  try {
    const action = parseEtaAction(await readJson<unknown>(request));
    organizationId = action.organizationId;
    documentId = action.documentId;
    const userClient = await authenticatedClient(request);

    if (action.action === "submit") {
      const { data, error } = await userClient.rpc(
        "request_eta_preproduction_submission",
        {
          p_organization_id: organizationId,
          p_document_id: documentId,
        },
      );
      if (error) throw error;
      mayRecordResult = true;
      const unsigned = buildEtaDocument(data);
      const issuer = unsigned.issuer as JsonRecord;
      if (issuer.id !== requiredEnv("ETA_ISSUER_REGISTRATION_NUMBER")) {
        throw new Error(
          "ETA_ISSUER_MISMATCH: configured server identity does not match the fiscal snapshot",
        );
      }
      const signed = await signEtaDocument(unsigned);
      const result = await submitEtaDocument(signed);
      const submissionUuid = result.submissionUUID as string;
      const rejected = firstRecord(result.rejectedDocuments);
      if (rejected) {
        const details = errorDetails(rejected.error);
        await recordResult({
          p_organization_id: organizationId,
          p_document_id: documentId,
          p_status: "rejected",
          p_submission_uuid: submissionUuid,
          p_error_code: details.code,
          p_error_message: details.message,
          p_provider_payload: result,
        });
        return json({
          status: "rejected",
          submissionUuid,
          error: details.message,
        }, 422);
      }
      const accepted = firstRecord(result.acceptedDocuments);
      if (!accepted || typeof accepted.uuid !== "string") {
        throw new Error("ETA accepted-document response is incomplete");
      }
      await recordResult({
        p_organization_id: organizationId,
        p_document_id: documentId,
        p_status: "submitted",
        p_submission_uuid: submissionUuid,
        p_eta_document_uuid: accepted.uuid,
        p_eta_long_id: typeof accepted.longId === "string"
          ? accepted.longId
          : null,
        p_provider_payload: result,
      });
      return json({
        status: "submitted",
        submissionUuid,
        documentUuid: accepted.uuid,
      }, 202);
    }

    const { data: context, error: contextError } = await userClient.rpc(
      "read_eta_preproduction_submission",
      {
        p_organization_id: organizationId,
        p_document_id: documentId,
      },
    );
    if (contextError) throw contextError;
    const state = context as JsonRecord;
    if (typeof state.submissionUuid !== "string") {
      throw new Error("ETA document has not been submitted");
    }
    mayRecordResult = true;
    const result = await pollEtaSubmission(state.submissionUuid);
    const summary = firstRecord(result.documentSummary);
    const providerStatus = typeof summary?.status === "string"
      ? summary.status.toLowerCase()
      : typeof result.overallStatus === "string"
      ? result.overallStatus.toLowerCase()
      : "in progress";
    const status =
      providerStatus === "in progress" || providerStatus === "submitted"
        ? "processing"
        : providerStatus === "valid" || providerStatus === "invalid" ||
            providerStatus === "rejected" || providerStatus === "cancelled"
        ? providerStatus
        : "processing";
    await recordResult({
      p_organization_id: organizationId,
      p_document_id: documentId,
      p_status: status,
      p_submission_uuid: state.submissionUuid,
      p_eta_document_uuid: typeof summary?.uuid === "string"
        ? summary.uuid
        : state.etaDocumentUuid,
      p_eta_long_id: typeof summary?.longId === "string"
        ? summary.longId
        : null,
      p_provider_payload: result,
    });
    return json({
      status,
      submissionUuid: state.submissionUuid,
      documentUuid: summary?.uuid ?? state.etaDocumentUuid,
    });
  } catch (error) {
    if (organizationId && documentId && mayRecordResult) {
      const transport = error instanceof EtaTransportError ? error : null;
      try {
        await recordResult({
          p_organization_id: organizationId,
          p_document_id: documentId,
          p_status: transport?.retryable ? "retry_wait" : "failed",
          p_error_code: transport
            ? "ETA_TRANSPORT_ERROR"
            : "ETA_LOCAL_VALIDATION_ERROR",
          p_error_message: publicMessage(error),
          p_retry_after_seconds: transport?.retryAfterSeconds ?? null,
        });
      } catch {
        // Preserve the original error; authorization failures can occur before a
        // delivery row was claimed and therefore have nothing to transition.
      }
    }
    return json(
      { error: publicMessage(error) },
      error instanceof EtaTransportError && error.retryable ? 503 : 400,
    );
  }
});
