import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { trackApiCall, calculateCost } from "@/lib/apiTracker";

export const runtime = "nodejs";
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
      "PLAIN names of current/active partners/directors/proprietors — NO honorifics, NO duplicates"
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
            "Turnover amount in standard Indian format. Use LACS (not Lucs/Lux) or CRORE."
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
          .describe("Contract value in standard Indian format using LACS or CRORE"),
        year: z.string().describe("Year of completion or execution"),
      })
    )
    .optional()
    .describe("List of past projects, works, or events completed"),
  certifications: z
    .array(z.string())
    .optional()
    .describe("Certifications like ISO 9001:2015, UDYAM, MSME, etc."),
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
    .describe("Best category for this document"),
  categoryConfidence: z
    .enum(["high", "medium", "low"])
    .describe("Confidence in category suggestion"),
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
    .describe("Up to 2 alternative categories"),
});

export async function POST(req: Request) {
  const { images, fileName, fileType } = await req.json();
  const startTime = Date.now();

  if (!images || !Array.isArray(images) || images.length === 0) {
    return Response.json(
      { error: "No images provided for vision extraction" },
      { status: 400 }
    );
  }

  const imageCount = Math.min(images.length, 10);

  try {
    const imageContents = images.slice(0, 10).map((img: string) => {
      const raw = img.includes(",") ? img.split(",")[1] : img;
      return {
        type: "image" as const,
        image: Buffer.from(raw, "base64"),
        mimeType: "image/jpeg" as const,
      };
    });

    const promptText = `You are an expert at extracting structured company information from Indian business documents used for government tender (B2G) bid preparation.

These are scanned pages from the document "${fileName}" (type: ${fileType}).

READ THE DOCUMENT CAREFULLY AND EXTRACT ALL INFORMATION:

EXTRACTION RULES:

1. Extract ONLY information explicitly visible in the document — never guess.

2. COMPANY NAME: Extract the legal/registered name. Drop "M/s" prefix.

3. PAN: 10-character alphanumeric code (ABCDE1234F format).

4. GSTIN: 15-character GST number.

5. PARTNERS / DIRECTORS:
   - In Indian partnership deeds, partners are listed as "1st Party", "2nd Party", "3rd Party" etc.
   - Extract ALL parties/partners listed in the deed. A partnership deed is a current legal document — everyone listed in it is an active partner.
   - Remove honorifics: Mr., Shri, Smt., Dr., Mrs., Sh., Sri → just the plain name.
   - Ignore "S/o" (Son of), "D/o" (Daughter of) clauses — those reference parents, not partners.

6. TURNOVER: Use LACS (never Lucs/Lux). Format: "Rs. 14.62 Lacs" or "Rs. 3.46 Crore"

7. REGISTERED ADDRESS: Look for the firm's registered office address, often mentioned after "at" or "situated at".

8. If a field is not visible in the document, omit it.

CATEGORY CLASSIFICATION:
- "Registration Certificates" — PAN card, GST certificate, partnership deed, UDYAM, ISO, company registration
- "Financial Documents" — Balance sheets, P&L, ITR, CA-certified turnover certificates
- "Experience" — Work completion certificates, appreciation letters
- "Work Orders (LOA/WO)" — LOAs, work orders, contracts
- "Firm Profile" — Company brochure, capability statement
- "Rent Agreements" — Rent/lease agreements
- "Net Worth" — Net worth certificates
- "Other" — Anything else`;

    const result = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: metadataSchema,
      messages: [
        {
          role: "user",
          content: [
            ...imageContents,
            { type: "text", text: promptText },
          ],
        },
      ],
    });

    const durationMs = Date.now() - startTime;
    const promptTokens = result.usage?.inputTokens ?? 0;
    const completionTokens = result.usage?.outputTokens ?? 0;
    const cost = calculateCost("gemini-2.5-flash", promptTokens, completionTokens, imageCount);

    await trackApiCall({
      endpoint: "/api/vault/extract-metadata-vision",
      model: "gemini-2.5-flash",
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      imageCount,
      estimatedCostUSD: cost.usd,
      estimatedCostINR: cost.inr,
      durationMs,
      status: "success",
      inputChars: promptText.length,
      page: "Vault - Document Upload",
      triggerType: "auto",
      promptSummary: "Metadata extraction (Vision) — extracts company info + categorizes scanned document",
      promptText: promptText,
    });

    return Response.json(result.object);
  } catch (e) {
    const durationMs = Date.now() - startTime;
    await trackApiCall({
      endpoint: "/api/vault/extract-metadata-vision",
      model: "gemini-2.5-flash",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      imageCount,
      estimatedCostUSD: 0,
      estimatedCostINR: 0,
      durationMs,
      status: "error",
      errorMessage: e instanceof Error ? e.message : "Unknown error",
      inputChars: 0,
      page: "Vault - Document Upload",
      triggerType: "auto",
      promptSummary: "Metadata extraction (Vision) — failed",
      promptText: "",
    });
    console.error("Vision metadata extraction failed:", e);
    return Response.json(
      { error: "Failed to extract metadata from images" },
      { status: 500 }
    );
  }
}
