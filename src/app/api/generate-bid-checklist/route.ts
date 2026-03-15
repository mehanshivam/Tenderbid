import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { trackApiCall, calculateCost } from "@/lib/apiTracker";

export const maxDuration = 60;

const formTagValues = [
  "Needs Notarization",
  "Needs Stamp Paper",
  "Needs Company Seal",
  "Needs Attestation",
  "Needs Affidavit",
  "Needs Witness Signature",
  "Needs Court Fee Stamp",
  "Needs Board Resolution",
  "On Company Letterhead",
] as const;

const bidChecklistSchema = z.object({
  items: z.array(
    z.object({
      name: z
        .string()
        .describe(
          "Short category name. For annexures, use format 'Annexure-X: Title' (e.g. 'Annexure-1: Bidding Capacity'). For documents, use 2-4 words (e.g. 'Registration Certificate', 'Financial Documents')."
        ),
      particular: z
        .string()
        .describe(
          "Comma-separated list of specific items/fields needed under this category. For annexures, describe what needs to be filled."
        ),
      sourcePages: z
        .array(z.number())
        .describe("RFP page numbers where these requirements are mentioned"),
      type: z
        .enum(["document", "annexure"])
        .describe(
          "'annexure' for forms/annexures/declarations that the bidder must fill out and submit. 'document' for existing documents to collect (certificates, balance sheets, etc.)"
        ),
      tags: z
        .array(z.enum(formTagValues))
        .describe(
          "Special requirements for this item. Detect from the document text: stamp paper, notarization, company letterhead, company seal, affidavit, witness signature, court fee stamp, board resolution."
        ),
    })
  ).min(10).max(25).describe("Between 10 and 25 checklist items. Merge related documents to stay under 25."),
});

export async function POST(req: Request) {
  const { documentContext, companyProfile, vaultDocuments } = await req.json();
  const startTime = Date.now();

  if (!documentContext) {
    return Response.json(
      { error: "No document context provided" },
      { status: 400 }
    );
  }

  const vaultContext = companyProfile
    ? `\nCOMPANY PROFILE:\n${JSON.stringify(companyProfile, null, 2)}\n\nVAULT DOCUMENTS:\n${
        vaultDocuments?.length
          ? vaultDocuments
              .map((d: { name: string; category: string }) => `- ${d.name} [${d.category}]`)
              .join("\n")
          : "None"
      }`
    : "";

  const prompt = `You are a tender bid preparation expert for Indian government tenders. Analyze this RFP and create a comprehensive bid preparation checklist.

TENDER DOCUMENT:
${documentContext.slice(0, 80000)}
${vaultContext}

TASK: Create a checklist of ALL items a bidder must prepare and submit. This checklist is the single source of truth for the bid preparation team.

CRITICAL RULES:

1. **ANNEXURES MUST BE SEPARATE**: Each annexure, declaration, affidavit, or fillable form mentioned in the RFP MUST be its own separate checklist item. NEVER merge multiple annexures into one item. If the document has Annexure-1, Annexure-2, Annexure-3, etc., each gets its own row.

2. **TYPE FIELD**:
   - type="annexure" for any form, annexure, declaration, affidavit, schedule, or format that the bidder must FILL OUT and submit
   - type="document" for existing documents to COLLECT (certificates, balance sheets, work orders, etc.)

3. **NAMING**:
   - For annexures: "Annexure-X: [Short Title]" (e.g., "Annexure-1: Bidding Capacity", "Annexure-3: Not Blacklisted Declaration")
   - For documents: Short category name, 2-4 words (e.g., "Registration Certificate", "Financial Documents")

4. **TAGS** — Detect special requirements from the document text and tag items:
   - "Needs Stamp Paper" — if the document says "stamp paper", "non-judicial stamp paper", "Rs.100 stamp paper"
   - "On Company Letterhead" — if it says "letterhead", "printed on bidder's letter head"
   - "Needs Notarization" — if it says "notarized", "notary"
   - "Needs Company Seal" — if it says "company seal", "firm seal"
   - "Needs Affidavit" — if the form IS an affidavit
   - "Needs Attestation" — if it says "attested", "attestation"
   - "Needs Witness Signature" — if it says "witness"
   - "Needs Board Resolution" — if it says "board resolution"

5. **PARTICULAR FIELD**: For annexures, describe exactly what the team member needs to fill in. For documents, list the specific sub-items needed.

6. **ORDERING**: Documents first (administrative, then eligibility, then financial, then technical), then annexures in their numbered order.

7. **SOURCE PAGES**: Use [Page X] markers from the document to populate sourcePages accurately.

8. **ITEM COUNT — STRICT LIMIT**: You MUST produce between 15 and 25 items total. NO MORE than 25. Group related documents aggressively — combine similar certificates (e.g. "Registration & Trade License", "Tax Compliance Documents"). Each annexure stays separate, but documents MUST be consolidated. If you have more than 25 items, merge document categories until you are under 25.

EXAMPLE OUTPUT:
- name: "Bid Processing Fees & EMD", type: "document", particular: "Demand Draft for bid fee Rs. 2000+300+GST, DD for EMD Rs. 46 Lakhs, in favour of Secretary BSGUP", tags: []
- name: "Registration Certificate", type: "document", particular: "Certificate of Incorporation under Companies Act / LLP Act / Partnership deed", tags: []
- name: "Annexure-1: Bidding Capacity", type: "annexure", particular: "Calculate bidding capacity using formula A×N×2-B, fill firm name, work name, capacity amount", tags: ["Needs Stamp Paper"]
- name: "Annexure-3: Not Blacklisted Declaration", type: "annexure", particular: "Declaration on company letterhead that firm has not been blacklisted by any Govt/Semi-Govt", tags: ["On Company Letterhead"]
- name: "Annexure-6: General Affidavit", type: "annexure", particular: "Affidavit certifying truthfulness of statements, no abandoned work, bid valid for 90 days", tags: ["Needs Stamp Paper", "Needs Affidavit"]

Return ALL items needed for a complete bid submission.`;

  const inputChars = prompt.length;

  try {
    const result = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: bidChecklistSchema,
      prompt,
      temperature: 0,
    });

    const durationMs = Date.now() - startTime;
    const promptTokens = result.usage?.inputTokens ?? 0;
    const completionTokens = result.usage?.outputTokens ?? 0;
    const cost = calculateCost("gemini-2.5-flash", promptTokens, completionTokens);

    await trackApiCall({
      endpoint: "/api/generate-bid-checklist",
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
      page: "Bid Workspace - Workflow",
      triggerType: "click",
      promptSummary: "Bid preparation checklist — extracts documents + annexures from RFP with tags",
      promptText: prompt,
    });

    const items = result.object.items.map((item, i) => ({
      ...item,
      id: i + 1,
      status: "pending" as const,
    }));

    return Response.json({ items });
  } catch (e) {
    const durationMs = Date.now() - startTime;
    await trackApiCall({
      endpoint: "/api/generate-bid-checklist",
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
      page: "Bid Workspace - Workflow",
      triggerType: "click",
      promptSummary: "Bid preparation checklist — failed",
      promptText: prompt,
    });
    console.error("Bid checklist generation failed:", e);
    return Response.json(
      { error: "Failed to generate bid checklist" },
      { status: 500 }
    );
  }
}
