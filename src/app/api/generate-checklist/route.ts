import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { trackApiCall, calculateCost } from "@/lib/apiTracker";

export const runtime = "nodejs";
export const maxDuration = 60;

const checklistSchema = z.object({
  sections: z.array(
    z.object({
      title: z.enum([
        "Eligibility Requirements",
        "Documents Required",
        "Forms & Annexures to Fill",
      ]),
      items: z.array(
        z.object({
          requirement: z
            .string()
            .describe("Exact requirement from the RFP"),
          status: z.enum(["met", "not_met", "partial", "unknown"]),
          reasoning: z
            .string()
            .describe(
              "Explain why this status was assigned based on the company profile and vault documents"
            ),
          sourcePages: z
            .array(z.number())
            .describe("Page numbers from [Page X] markers where this requirement appears"),
          matchedVaultDocs: z
            .array(z.string())
            .optional()
            .describe("Names of vault documents that matched this requirement"),
          matchedProfileField: z
            .string()
            .optional()
            .describe("Which company profile field matched (e.g. turnoverHistory, certifications, pan)"),
        })
      ),
    })
  ),
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

  const hasVault = companyProfile || (vaultDocuments && vaultDocuments.length > 0);

  const vaultContext = hasVault
    ? `
COMPANY PROFILE (from vault):
${companyProfile ? JSON.stringify(companyProfile, null, 2) : "Not available"}

VAULT DOCUMENTS (uploaded by the company):
${
  vaultDocuments && vaultDocuments.length > 0
    ? vaultDocuments
        .map(
          (d: { name: string; category: string; fileType: string }) =>
            `- ${d.name} [Category: ${d.category}, Type: ${d.fileType}]`
        )
        .join("\n")
    : "No documents uploaded"
}
`
    : `
COMPANY VAULT: Not set up. Mark all eligibility and document requirements as "unknown" with reasoning "No company vault data available for matching."
`;

  const prompt = `You are a compliance analyst for Indian government tenders. Analyze the following tender/RFP document and generate a comprehensive compliance checklist.

TENDER DOCUMENT:
${documentContext.slice(0, 80000)}

${vaultContext}

INSTRUCTIONS:

Generate a checklist with exactly 3 sections:

## Section 1: "Eligibility Requirements"
Extract ALL eligibility criteria the bidder must satisfy. Common ones in Indian tenders:
- Minimum firm age (e.g. "registered for at least 3 years")
- Minimum annual turnover threshold (e.g. "average annual turnover of Rs. 50 Lacs in last 3 financial years")
- Similar work experience (e.g. "completed 3 similar works of value Rs. 10 Lacs each")
- Specific registrations required (GST, PAN, MSME/UDYAM, labor license, ESI, PF, etc.)
- EMD / bid security requirement
- Solvency certificate requirement
- Not blacklisted / no failed contracts
- Class/category of contractor registration
- Joint venture / consortium rules
- Any location-specific requirements

For each requirement, compare against the company profile:
- "met": Profile clearly satisfies (e.g. turnover Rs. 80 Lacs vs threshold Rs. 50 Lacs)
- "not_met": Profile clearly fails (e.g. only 2 similar works vs 3 required)
- "partial": Partially satisfied (e.g. 2 of 3 required balance sheets)
- "unknown": Cannot determine from available data

## Section 2: "Documents Required"
Extract ALL documents the bidder must submit. Common ones:
- PAN Card copy
- GST Registration Certificate
- Audited Balance Sheets (specify how many years)
- Income Tax Returns
- CA-certified turnover certificate
- Solvency certificate from bank
- EMD proof (DD/BG details)
- Partnership deed / Certificate of Incorporation
- Work completion certificates
- Work order copies
- Experience certificates
- MSME/UDYAM certificate
- Power of Attorney / Board Resolution
- Tender fee receipt

Match against vault documents by name and category:
- "met": A matching document exists in vault (e.g. PAN card in "Registration Certificates")
- "partial": Some but not all required (e.g. 2 of 3 balance sheets found)
- "not_met": No matching document found
- "unknown": Cannot determine

## Section 3: "Forms & Annexures to Fill"
List ALL forms, annexures, declarations, and undertakings the bidder must fill out and submit.
For these items:
- "partial" if such a form type exists in the document (bidder still needs to fill it)
- "not_met" if the form is referenced but not found in the document
- "unknown" if unclear

RULES:
1. Use [Page X] markers from the document to populate sourcePages accurately
2. Be thorough — extract EVERY requirement, even minor ones
3. Include specific numbers/thresholds in the requirement text (e.g. "Rs. 50 Lacs" not just "minimum turnover")
4. Keep reasoning concise but specific — reference actual vault data values when comparing
5. matchedVaultDocs should contain actual document names from the vault list when applicable
6. matchedProfileField should name the specific field (e.g. "turnoverHistory", "pastProjects", "pan", "gstin", "certifications", "partners", "yearOfEstablishment")
`;

  const inputChars = prompt.length;

  try {
    const result = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: checklistSchema,
      prompt,
    });

    const durationMs = Date.now() - startTime;
    const promptTokens = result.usage?.inputTokens ?? 0;
    const completionTokens = result.usage?.outputTokens ?? 0;
    const cost = calculateCost("gemini-2.5-flash", promptTokens, completionTokens);

    await trackApiCall({
      endpoint: "/api/generate-checklist",
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
      page: "Bid Workspace - Checklist",
      triggerType: "click",
      promptSummary: "Compliance checklist — analyzes RFP against company vault (eligibility, docs, forms)",
      promptText: prompt,
    });

    const allItems = result.object.sections.flatMap((s) => s.items);
    const summary = {
      total: allItems.length,
      met: allItems.filter((i) => i.status === "met").length,
      notMet: allItems.filter((i) => i.status === "not_met").length,
      partial: allItems.filter((i) => i.status === "partial").length,
      unknown: allItems.filter((i) => i.status === "unknown").length,
    };

    return Response.json({ ...result.object, summary });
  } catch (e) {
    const durationMs = Date.now() - startTime;
    await trackApiCall({
      endpoint: "/api/generate-checklist",
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
      page: "Bid Workspace - Checklist",
      triggerType: "click",
      promptSummary: "Compliance checklist — failed",
      promptText: prompt,
    });
    console.error("Checklist generation failed:", e);
    return Response.json(
      { error: "Failed to generate compliance checklist" },
      { status: 500 }
    );
  }
}
