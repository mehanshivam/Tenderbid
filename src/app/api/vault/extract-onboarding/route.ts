import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

export const maxDuration = 60; // Allow up to 60s for vision extraction (Pro plan: 60s, Hobby: 10s)

const onboardingSchema = z.object({
  companyName: z
    .string()
    .describe("The legal/registered name of the company/firm. Drop M/s prefix."),
  pan: z
    .string()
    .describe("PAN number (10-character alphanumeric ABCDE1234F). Empty string if not found."),
  gstin: z
    .string()
    .describe("GSTIN (15-character). Empty string if not found."),
  registeredAddress: z
    .string()
    .describe("Registered office address. Empty string if not found."),
  yearOfEstablishment: z
    .number()
    .optional()
    .describe(
      "Year the firm/company was established or the deed was executed. Extract from phrases like 'executed on 15th day of March 2019' or 'established in the year 2005' or 'date of incorporation'. Return just the 4-digit year."
    ),
  stateCity: z
    .string()
    .optional()
    .describe(
      "State and city of the firm, derived from the registered address. Format: 'City, State' e.g. 'Agra, Uttar Pradesh'."
    ),
  partners: z
    .array(z.string())
    .describe(
      "ALL partners/directors/proprietor listed in the document. Plain names only — no honorifics (Mr./Shri/Smt./Dr./Sri/Sh.)."
    ),
});

const ENTITY_PROMPTS: Record<string, string> = {
  "Partnership Firm": `This is a PARTNERSHIP DEED. Partners are listed as "1st Party", "2nd Party", "3rd Party" etc.
Extract ALL partners listed. Everyone in the deed is an active partner.
Ignore "S/o" / "D/o" / "W/o" clauses — those reference parents/spouse, not partners.
Look for the firm name, PAN numbers, GSTIN, and registered address (often after "at" or "situated at").
The deed execution date gives the year of establishment — look for "executed on the Xth day of Month Year" or similar phrasing.
Derive the state and city from the registered address.`,

  "Private Limited": `This is a CERTIFICATE OF INCORPORATION or MOA/AOA for a Private Limited company.
Extract the company name, CIN/registration number, registered address, and all directors listed.
PAN and GSTIN may be on separate pages or certificates.`,

  "Public Limited": `This is a CERTIFICATE OF INCORPORATION or MOA/AOA for a Public Limited company.
Extract the company name, CIN/registration number, registered address, and all directors listed.`,

  LLP: `This is an LLP AGREEMENT or LLP INCORPORATION CERTIFICATE.
Extract the LLP name, LLPIN, registered address, and all designated partners listed.
Partners in an LLP are called "Designated Partners".`,

  Proprietorship: `This is a UDYAM REGISTRATION or GST CERTIFICATE for a Proprietorship.
Extract the proprietor's name, firm name, PAN, GSTIN, UDYAM number, and registered address.
The proprietor is the single owner.`,

  Society: `This is a SOCIETY REGISTRATION CERTIFICATE.
Extract the society name, registration number, registered address, and office bearers/members listed.`,

  Trust: `This is a TRUST DEED.
Extract the trust name, registration number, registered address, and all trustees listed.`,
};

export async function POST(req: Request) {
  const { text, images, fileName, fileType, entityType } = await req.json();

  const hasText = text && text.trim().length >= 50;
  const hasImages = images && Array.isArray(images) && images.length > 0;

  if (!hasText && !hasImages) {
    return Response.json(
      { error: "No text or images provided" },
      { status: 400 }
    );
  }

  const entityPrompt =
    ENTITY_PROMPTS[entityType] || ENTITY_PROMPTS["Partnership Firm"];

  try {
    if (hasImages) {
      // Vision-based extraction — preferred when images are available
      // (scanned PDFs often have garbled text layers that pass the length check)
      // Convert base64 strings to Buffers — AI SDK doesn't accept raw base64 or data: URLs
      const imageContents = images.slice(0, 8).map((img: string) => {
        // Strip data URL prefix if present (e.g. "data:image/jpeg;base64,")
        const raw = img.includes(",") ? img.split(",")[1] : img;
        return {
          type: "image" as const,
          image: Buffer.from(raw, "base64"),
          mimeType: "image/jpeg" as const,
        };
      });

      const result = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: onboardingSchema,
        messages: [
          {
            role: "user",
            content: [
              ...imageContents,
              {
                type: "text",
                text: `You are an expert at reading Indian business registration documents for government tender bid preparation.

This is a scanned document: "${fileName}" (${fileType}) for a ${entityType}.

${entityPrompt}

RULES:
- Extract ONLY what is explicitly visible in the document
- Remove all honorifics from names (Mr., Shri, Smt., Dr., Sri, Sh.)
- PAN format: ABCDE1234F (10 chars). GSTIN format: 15 chars.
- If a field is not visible, return empty string
- For address, provide the complete registered address`,
              },
            ],
          },
        ],
      });

      console.log("[Onboarding Vision] Images sent:", imageContents.length, "Result:", JSON.stringify(result.object));
      return Response.json(result.object);
    } else {
      // Text-based extraction
      const result = await generateObject({
        model: google("gemini-2.5-flash"),
        schema: onboardingSchema,
        prompt: `You are an expert at reading Indian business registration documents for government tender bid preparation.

DOCUMENT: "${fileName}" (${fileType}) for a ${entityType}.

${entityPrompt}

CONTENT:
${text.slice(0, 80000)}

RULES:
- Extract ONLY information explicitly stated in the document
- Remove all honorifics from names (Mr., Shri, Smt., Dr., Sri, Sh.)
- PAN format: ABCDE1234F (10 chars). GSTIN format: 15 chars.
- If a field is not found, return empty string
- For address, provide the complete registered address`,
      });

      return Response.json(result.object);
    }
  } catch (e) {
    console.error("Onboarding extraction failed:", e);
    return Response.json(
      { error: "Failed to extract data from document" },
      { status: 500 }
    );
  }
}
