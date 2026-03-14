import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

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
    .describe("Names of partners, directors, or proprietors"),
  turnover: z
    .array(
      z.object({
        year: z
          .string()
          .describe("Financial year, e.g. '2023-24' or 'FY 2024'"),
        amount: z
          .string()
          .describe(
            "Turnover amount with unit, e.g. 'Rs. 3.5 Crore' or '35,00,000'"
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
            "Contract value with unit, e.g. 'Rs. 45 Lakh' or '45,00,000'"
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
      "Certifications like ISO, UDYAM, MSME, or any quality/registration certificates"
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

  if (!text || text.trim().length < 50) {
    return Response.json(
      { error: "Insufficient text content for extraction" },
      { status: 400 }
    );
  }

  try {
    const result = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: metadataSchema,
      prompt: `You are an expert at extracting structured company information from Indian business documents.

DOCUMENT: "${fileName}" (type: ${fileType})

CONTENT:
${text.slice(0, 80000)}

INSTRUCTIONS:
Extract ALL relevant company/firm information from this document. This could be any type of business document:
- Registration certificates (PAN card, GST certificate, partnership deed, UDYAM, ISO)
- Financial documents (balance sheets, profit & loss statements, ITR, CA certificates)
- Experience documents (work completion certificates, LOAs, appreciation letters)
- Work orders (government or private contracts awarded)
- Firm profile (company brochure, capability statement)
- Net worth certificates
- Rent agreements (may contain address info)

EXTRACTION RULES:
1. Extract ONLY information explicitly stated in the document — never guess or infer
2. For PAN: Look for 10-character alphanumeric codes (format: ABCDE1234F)
3. For GST: Look for 15-digit GST numbers
4. For turnover: Extract year-wise figures if available (from balance sheets, CA certificates)
5. For past projects: Extract project name, client, contract value, and year from work orders, LOAs, or experience lists
6. For partners/directors: Extract names of all partners, directors, or the proprietor
7. If a field is not present in this document, omit it (do not return empty strings)
8. Return amounts in their original format (e.g., "Rs. 3,45,67,890" or "Rs. 3.46 Crore")

Extract everything you can find. This data will be used to build a company profile for bid preparation.

CATEGORY CLASSIFICATION:
You MUST also classify this document into one of these categories:
- "Registration Certificates" — PAN card, GST certificate, partnership deed, UDYAM registration, ISO certificate, company registration
- "Financial Documents" — Balance sheets, P&L statements, ITR, CA-certified turnover certificates, bank statements
- "Experience" — Work completion certificates, appreciation letters, performance certificates, experience summaries
- "Work Orders (LOA/WO)" — Letters of Award, work orders, contracts, purchase orders, appointment letters for projects
- "Firm Profile" — Company brochure, capability statement, about us document, organizational chart
- "Rent Agreements" — Office rent/lease agreements, property agreements
- "Net Worth" — Net worth certificates, CA-certified net worth statements
- "Other" — Anything that doesn't clearly fit above

Provide your best category, confidence level, and up to 2 alternatives.`,
    });

    return Response.json(result.object);
  } catch (e) {
    console.error("Vault metadata extraction failed:", e);
    return Response.json(
      { error: "Failed to extract metadata" },
      { status: 500 }
    );
  }
}
