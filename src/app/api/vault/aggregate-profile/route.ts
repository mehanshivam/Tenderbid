import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

export const maxDuration = 60;

const profileSchema = z.object({
  entityType: z
    .enum([
      "Partnership Firm",
      "Private Limited",
      "Public Limited",
      "LLP",
      "Proprietorship",
      "Society",
      "Trust",
      "Other",
    ])
    .describe(
      "The type of business entity, inferred from the documents (partnership deed → Partnership Firm, certificate of incorporation → Pvt Ltd/Ltd, LLP agreement → LLP, single owner docs → Proprietorship, etc.)"
    ),
  companyName: z
    .string()
    .describe("The correct, full legal name of the company/firm"),
  pan: z.string().describe("PAN number. Empty string if not found."),
  gstin: z.string().describe("GSTIN number. Empty string if not found."),
  registeredAddress: z
    .string()
    .describe(
      "Current registered office address. Empty string if not found."
    ),
  partners: z
    .array(z.string())
    .describe(
      "Current active partners/directors/promoters/proprietor. Plain names, no honorifics, no duplicates."
    ),
  turnoverHistory: z
    .array(
      z.object({
        year: z
          .string()
          .describe("Financial year in 'YYYY-YY' format, e.g. '2023-24'"),
        amount: z
          .string()
          .describe(
            "Amount in standard Indian format using LACS or CRORE (never Lucs/Lux)"
          ),
      })
    )
    .describe(
      "Turnover figures sorted by year, deduplicated. Use consistent units."
    ),
  pastProjects: z
    .array(
      z.object({
        name: z.string(),
        client: z.string(),
        value: z.string(),
        year: z.string(),
      })
    )
    .describe(
      "Deduplicated list of past projects/events/works. Merge entries that are clearly the same project."
    ),
  certifications: z
    .array(z.string())
    .describe(
      "Deduplicated certifications with full details (e.g., 'ISO 9001:2015' not just 'ISO')"
    ),
});

export async function POST(req: Request) {
  const { entries } = await req.json();

  if (!entries || !Array.isArray(entries) || entries.length === 0) {
    return Response.json(
      { error: "No metadata entries provided" },
      { status: 400 }
    );
  }

  try {
    // Format the raw extracted data for the AI
    const rawData = entries
      .map(
        (
          e: {
            id: string;
            fileName?: string;
            category?: string;
            metadata: Record<string, unknown>;
          },
          i: number
        ) => {
          const label = [
            e.fileName && `File: ${e.fileName}`,
            e.category && `Category: ${e.category}`,
          ]
            .filter(Boolean)
            .join(", ");
          return `--- Document ${i + 1}${label ? ` (${label})` : ""} ---\n${JSON.stringify(e.metadata, null, 1)}`;
        }
      )
      .join("\n\n");

    const result = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: profileSchema,
      prompt: `You are a data cleaning expert for Indian business profiles used in government tender (B2G) bid preparation.

Below is RAW metadata extracted from ${entries.length} company documents by an AI. Your job is to produce ONE clean, accurate company profile.

STEP 1 — DETECT ENTITY TYPE:
First, determine the type of business entity from the documents:
- Partnership Deed present → "Partnership Firm"
- Certificate of Incorporation / MOA / AOA present → "Private Limited" or "Public Limited"
- LLP Agreement / LLP Incorporation Certificate → "LLP"
- Only individual owner documents (single PAN, no deed/incorporation) → "Proprietorship"
- Society Registration Certificate → "Society"
- Trust Deed → "Trust"

STEP 2 — APPLY THE CORRECT AUTHORITY HIERARCHY:
Different entity types have different "source of truth" documents:

FOR PARTNERSHIP FIRM:
- Partners → Trust the PARTNERSHIP DEED. Everyone listed is an active partner. The deed is always current.
- Address → Trust Partnership Deed for registered address.

FOR PRIVATE LIMITED / PUBLIC LIMITED:
- Directors → Trust Certificate of Incorporation, MOA/AOA, or Board Resolution.
- Address → Trust Certificate of Incorporation.

FOR LLP:
- Partners → Trust the LLP Agreement or LLP Incorporation Certificate.
- Address → Trust LLP certificate.

FOR PROPRIETORSHIP:
- Proprietor → Trust PAN card, UDYAM registration, or GST certificate (single owner).
- Address → Trust GST or UDYAM registration.

FOR ALL ENTITY TYPES:
- PAN / GSTIN → Trust Registration Certificates (PAN card, GST certificate) over casual mentions.
- TURNOVER → Trust CA-certified turnover certificates and audited balance sheets.
- PAST PROJECTS → Trust Work Orders (LOA/WO) and Experience certificates. Merge duplicates.
- The incorporation/registration document is the source of truth for who the owners/partners/directors are. Work orders, LOAs, and experience letters may mention names but are NOT authoritative.

RAW EXTRACTED DATA:
${rawData.slice(0, 100000)}

CLEANING RULES:

1. COMPANY NAME: Pick the most common/correct legal name. Drop "M/s" prefix.

2. PAN & GSTIN: Validate format. PAN = exactly 10 alphanumeric (ABCDE1234F). GSTIN = exactly 15 chars.

3. PARTNERS / DIRECTORS / PROPRIETOR:
   - Use the incorporation/registration document as the PRIMARY source (deed, certificate, LLP agreement).
   - Everyone listed in that document is active. Include ALL of them.
   - MERGE duplicates: "Abhishek Singhal" = "Mr. Abhishek Singhal" = "Shri Abhishek Singhal" → "Abhishek Singhal"
   - FIX OCR typos (pick the most common/correct spelling)
   - NO honorifics (Mr./Shri/Smt./Dr./Sh./Sri)
   - Ignore "S/o" / "D/o" / "W/o" clauses — those reference parents/spouse, not additional partners.

4. TURNOVER:
   - "Lucs" → "Lacs", "Lux" → "Lacs" (these are OCR errors)
   - Use consistent format: "Rs. X.XX Lacs" or "Rs. X.XX Crore"
   - 1 Crore = 100 Lacs = 1,00,00,000
   - Deduplicate by year, sort ascending

5. PAST PROJECTS:
   - Merge clearly duplicate projects (similar name + same client)
   - Fix "Lucs" → "Lacs" in amounts
   - Keep unique projects only

6. CERTIFICATIONS:
   - Full name with standard number, e.g., "ISO 9001:2015"
   - Deduplicate

Return the cleaned, production-ready company profile.`,
    });

    return Response.json(result.object);
  } catch (e) {
    console.error("Profile aggregation failed:", e);
    return Response.json(
      { error: "Failed to aggregate profile" },
      { status: 500 }
    );
  }
}
