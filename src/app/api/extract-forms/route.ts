import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { trackApiCall, calculateCost } from "@/lib/apiTracker";

export const runtime = "nodejs";
export const maxDuration = 60;

const formTagEnum = z.enum([
  "Needs Notarization",
  "Needs Stamp Paper",
  "Needs Company Seal",
  "Needs Attestation",
  "Needs Affidavit",
  "Needs Witness Signature",
  "Needs Court Fee Stamp",
  "Needs Board Resolution",
]);

const formSchema = z.object({
  forms: z.array(
    z.object({
      title: z.string().describe("Form title, e.g. 'Annexure-1: Form for Bidder\\'s Bidding Capacity'"),
      type: z.enum(["form", "annexure", "schedule", "declaration", "other"]),
      sourcePages: z.array(z.number()),
      contentHtml: z
        .string()
        .describe(
          "The COMPLETE form content as HTML that a bidder would print and fill out. Use <table>, <tr>, <td>, <th> for tables. Use <p> for paragraphs, <h3> for section titles, <strong> for labels. For blank fields / lines that bidders need to fill, use <input> style placeholders like _____________ or [TO BE FILLED]. Preserve the EXACT original structure, all rows, all fields. Do NOT summarize or truncate."
        ),
      tags: z
        .array(formTagEnum)
        .describe(
          "Requirements detected from the form text. Look for mentions of: notarization/notary, stamp paper (judicial/non-judicial), company seal/rubber stamp, attestation by gazetted officer, affidavit, witness signatures, court fee stamps, board resolution/authority letter."
        ),
    })
  ),
});

export async function POST(req: Request) {
  const { documentContext } = await req.json();
  const startTime = Date.now();

  if (!documentContext) {
    return Response.json(
      { error: "No document context provided" },
      { status: 400 }
    );
  }

  const prompt = `You are a tender document analyst. Analyze the following tender/RFP document and extract EVERY annexure, form, declaration, affidavit, undertaking, certificate format, and bid format that a bidder must fill out and submit.

DOCUMENT CONTENT:
${documentContext.slice(0, 80000)}

CRITICAL INSTRUCTIONS:

1. WHAT TO EXTRACT — look for ALL of these:
   - Annexures (Annexure-1, Annexure-2, etc.) — these are fillable forms at the end of the RFP
   - Technical Bid format tables (criteria tables the bidder must fill)
   - Declaration letters (blacklisting, no failed agreements, etc.)
   - Affidavits (on stamp paper)
   - Bank certificate formats
   - Bidding capacity calculation forms
   - Undertaking formats
   - Any table or letter format with blank fields for the bidder to complete

2. HOW TO EXTRACT:
   - Reproduce the COMPLETE content of each form as HTML
   - For tables: use <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%"> with <tr>, <td>, <th>
   - For letter-style forms: use <p> tags preserving paragraph structure
   - For headings within a form: use <h3> or <strong>
   - For blank lines/fields: use _____________ (underscores) or [TO BE FILLED]
   - Include ALL rows and columns — never truncate tables
   - Include "Seal & Signature" lines, date fields, name fields
   - Each annexure/form is a SEPARATE item in the forms array

3. sourcePages: Use the [Page X] markers in the document to identify which pages each form spans.

4. TAGS — For each form, detect special requirements by scanning for these keywords:
   - "Needs Notarization" — if form mentions "notarized", "notary", "notarization"
   - "Needs Stamp Paper" — if form mentions "stamp paper", "non-judicial stamp", "judicial stamp paper", "on Rs. __ stamp paper"
   - "Needs Company Seal" — if form mentions "company seal", "rubber stamp", "office seal", "seal of the firm"
   - "Needs Attestation" — if form mentions "attested", "attestation", "gazetted officer", "self-attested"
   - "Needs Affidavit" — if form mentions "affidavit", "sworn statement"
   - "Needs Witness Signature" — if form mentions "witness", "witnessed by"
   - "Needs Court Fee Stamp" — if form mentions "court fee", "court stamp"
   - "Needs Board Resolution" — if form mentions "board resolution", "authorized signatory", "authority letter"
   Include ALL applicable tags. If none apply, return an empty array.

5. ORDERING: Extract in document order.

6. DO NOT extract the tender notice itself, instructions, or eligibility criteria — only extract fillable forms/annexures.

Return ALL forms found. If there are no forms, return an empty array.`;

  const inputChars = prompt.length;

  try {
    const result = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: formSchema,
      prompt,
    });

    const durationMs = Date.now() - startTime;
    const promptTokens = result.usage?.inputTokens ?? 0;
    const completionTokens = result.usage?.outputTokens ?? 0;
    const cost = calculateCost("gemini-2.5-flash", promptTokens, completionTokens);

    await trackApiCall({
      endpoint: "/api/extract-forms",
      model: "gemini-2.5-flash",
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      imageCount: 0,
      estimatedCostUSD: cost.usd,
      estimatedCostINR: cost.inr,
      durationMs,
      status: "success",
      inputChars,
      page: "Bid Workspace - Forms",
      triggerType: "click",
      promptSummary: "Form extraction — extracts all annexures/forms/declarations as HTML from RFP",
      promptText: prompt,
    });

    return Response.json(result.object);
  } catch (e) {
    const durationMs = Date.now() - startTime;
    await trackApiCall({
      endpoint: "/api/extract-forms",
      model: "gemini-2.5-flash",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      imageCount: 0,
      estimatedCostUSD: 0,
      estimatedCostINR: 0,
      durationMs,
      status: "error",
      errorMessage: e instanceof Error ? e.message : "Unknown error",
      inputChars,
      page: "Bid Workspace - Forms",
      triggerType: "click",
      promptSummary: "Form extraction — failed",
      promptText: prompt,
    });
    console.error("Form extraction failed:", e);
    return Response.json(
      { error: "Failed to extract forms from document" },
      { status: 500 }
    );
  }
}
