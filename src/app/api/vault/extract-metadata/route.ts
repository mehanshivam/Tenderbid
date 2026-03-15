import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { trackApiCall, calculateCost } from "@/lib/apiTracker";

export const maxDuration = 60;

const metadataSchema = z.object({
  companyName: z
    .string()
    .optional()
    .describe("The legal name of the company/firm/partnership"),
  pan: z
    .string()
    .optional()
    .describe("PAN number (10-character alphanumeric, e.g. ABCDE1234F)"),
  gstin: z
    .string()
    .optional()
    .describe("GST Identification Number (15-digit)"),
  registeredAddress: z
    .string()
    .optional()
    .describe("Registered office address of the company"),
  partners: z
    .array(z.string())
    .optional()
    .describe(
      "PLAIN names of partners/directors/proprietors — NO honorifics (Mr./Shri/Smt./Dr.), NO duplicates"
    ),
  turnover: z
    .array(
      z.object({
        year: z
          .string()
          .describe("Financial year in format 'YYYY-YY', e.g. '2023-24'"),
        amount: z
          .string()
          .describe(
            "Turnover amount in standard Indian format. Use LACS (not Lucs/Lux) or CRORE. Example: 'Rs. 14.62 Lacs' or 'Rs. 3.46 Crore' or '14,62,500'"
          ),
      })
    )
    .optional()
    .describe("Annual turnover figures by financial year"),
  pastProjects: z
    .array(
      z.object({
        name: z.string().describe("Project/event/work name or description"),
        client: z
          .string()
          .describe("Client name or organization that awarded the work"),
        value: z
          .string()
          .describe(
            "Contract value in standard Indian format: 'Rs. 45 Lacs' or '45,00,000' — use LACS not Lucs"
          ),
        year: z.string().describe("Year of completion or execution"),
      })
    )
    .optional()
    .describe("List of past projects, works, or events completed"),
  certifications: z
    .array(z.string())
    .optional()
    .describe(
      "Certifications like ISO 9001:2015, UDYAM, MSME, or any quality/registration certificates"
    ),
  suggestedCategory: z
    .enum([
      "Registration Certificates",
      "Financial Documents",
      "Experience",
      "Work Orders (LOA/WO)",
      "Firm Profile",
      "Rent Agreements",
      "Net Worth",
      "Other",
    ])
    .describe(
      "The BEST category for this document based on its content. PAN/GST/Partnership Deed/UDYAM/ISO → Registration Certificates. Balance sheets/ITR/Turnover certs → Financial Documents. Work completion certs/appreciation letters → Experience. LOAs/Work orders/Contracts → Work Orders (LOA/WO). Company brochure/capability statement → Firm Profile. Rent/lease agreements → Rent Agreements. Net worth certificates → Net Worth."
    ),
  categoryConfidence: z
    .enum(["high", "medium", "low"])
    .describe("How confident you are in the category suggestion"),
  alternateCategories: z
    .array(
      z.enum([
        "Registration Certificates",
        "Financial Documents",
        "Experience",
        "Work Orders (LOA/WO)",
        "Firm Profile",
        "Rent Agreements",
        "Net Worth",
        "Other",
      ])
    )
    .max(2)
    .describe(
      "Up to 2 alternative categories that could also fit this document"
    ),
});

export async function POST(req: Request) {
  const { text, fileName, fileType } = await req.json();
  const startTime = Date.now();

  if (!text || text.trim().length < 50) {
    return Response.json(
      { error: "Insufficient text content for extraction" },
      { status: 400 }
    );
  }

  const prompt = `You are an expert at extracting structured company information from Indian business documents used for government tender (B2G) bid preparation.

DOCUMENT: "${fileName}" (type: ${fileType})

CONTENT:
${text.slice(0, 80000)}

EXTRACTION RULES:

1. Extract ONLY information explicitly stated in the document — never guess or infer.

2. COMPANY NAME: Extract the legal/registered name of the firm (e.g., "M/s GKS Projects & Events" → "GKS Projects & Events"). Drop "M/s" prefix.

3. PAN: 10-character alphanumeric code (format: ABCDE1234F). Validate the format before including.

4. GSTIN: 15-character GST number. Validate the format before including.

5. PARTNERS / DIRECTORS:
   - Extract ALL partners/directors listed in the document. They are all active — a partnership deed is always current.
   - Remove honorifics: Mr., Shri, Smt., Dr., Mrs., Sh., Sri → just the plain name.
   - "Mr. Abhishek Singhal" → "Abhishek Singhal"
   - Do NOT include the same person twice with different prefixes.
   - Ignore "S/o" / "D/o" / "W/o" clauses — those reference parents/spouse, not additional partners.

6. TURNOVER / FINANCIAL AMOUNTS:
   - CRITICAL: The Indian unit is "LACS" (also spelled "Lakhs" or "Lakh"). It is NEVER "Lucs" or "Lux" — those are OCR errors.
   - Always normalize: "Lucs" → "Lacs", "Lux" → "Lacs", "Lac" → "Lacs"
   - Format: "Rs. 14.62 Lacs" or "Rs. 3.46 Crore" or "14,62,500"
   - 1 Crore = 100 Lacs. 1 Lac = 1,00,000.
   - Financial year format: "2023-24" (not "FY 2024" or "2023-2024")

7. PAST PROJECTS: Extract project name, client, contract value, and year. Apply the same "Lacs not Lucs" rule to all amounts.

8. CERTIFICATIONS: Include full certification details, e.g., "ISO 9001:2015" not just "ISO".

9. If a field is not present in this document, omit it entirely (do not return empty strings or empty arrays).

CATEGORY CLASSIFICATION:
Classify this document into one of these categories:
- "Registration Certificates" — PAN card, GST certificate, partnership deed, UDYAM registration, ISO certificate, company registration
- "Financial Documents" — Balance sheets, P&L statements, ITR, CA-certified turnover certificates, bank statements
- "Experience" — Work completion certificates, appreciation letters, performance certificates, experience summaries
- "Work Orders (LOA/WO)" — Letters of Award, work orders, contracts, purchase orders, appointment letters for projects
- "Firm Profile" — Company brochure, capability statement, about us document, organizational chart
- "Rent Agreements" — Office rent/lease agreements, property agreements
- "Net Worth" — Net worth certificates, CA-certified net worth statements
- "Other" — Anything that doesn't clearly fit above

Provide your best category, confidence level, and up to 2 alternatives.`;

  const inputChars = prompt.length;

  try {
    const result = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: metadataSchema,
      prompt,
    });

    const durationMs = Date.now() - startTime;
    const promptTokens = result.usage?.inputTokens ?? 0;
    const completionTokens = result.usage?.outputTokens ?? 0;
    const cost = calculateCost("gemini-2.5-flash", promptTokens, completionTokens);

    await trackApiCall({
      endpoint: "/api/vault/extract-metadata",
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
      page: "Vault - Document Upload",
      triggerType: "auto",
      promptSummary: "Metadata extraction (Text) — extracts company info + categorizes document from text",
      promptText: prompt,
    });

    return Response.json(result.object);
  } catch (e) {
    const durationMs = Date.now() - startTime;
    await trackApiCall({
      endpoint: "/api/vault/extract-metadata",
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
      page: "Vault - Document Upload",
      triggerType: "auto",
      promptSummary: "Metadata extraction (Text) — failed",
      promptText: prompt,
    });
    console.error("Vault metadata extraction failed:", e);
    return Response.json(
      { error: "Failed to extract metadata" },
      { status: 500 }
    );
  }
}
