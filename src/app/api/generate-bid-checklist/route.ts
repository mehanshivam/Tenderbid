import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

export const maxDuration = 60;

const bidChecklistSchema = z.object({
  items: z.array(
    z.object({
      name: z
        .string()
        .describe("Short category name, 2-4 words (e.g. 'Cover Letter', 'General Documents', 'Financial Capacity')"),
      particular: z
        .string()
        .describe("Comma-separated list of specific items needed under this category"),
      sourcePages: z
        .array(z.number())
        .describe("RFP page numbers where these requirements are mentioned"),
    })
  ),
});

export async function POST(req: Request) {
  const { documentContext, companyProfile, vaultDocuments } = await req.json();

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

  try {
    const result = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: bidChecklistSchema,
      prompt: `You are a tender bid preparation expert for Indian government tenders. Analyze this RFP and create a consolidated bid preparation checklist.

TENDER DOCUMENT:
${documentContext.slice(0, 80000)}
${vaultContext}

TASK: Create a checklist of 8-15 items that a bidder must prepare and submit. Group related requirements into logical bid preparation categories.

RULES:
1. Each item should be a logical GROUP of related documents/requirements, not individual items
2. Use short names (2-4 words): "Cover Letter", "Drafts Fees & EMD", "General Documents", "CA Certificate", "Financial Capacity", "Experience Certificates", "Similar Work Orders", "Manpower Details", "Technical Presentation", "Company Profile", "Affidavits & Declarations", "Power of Attorney", etc.
3. The "particular" field should list the specific sub-items in that category, comma-separated
4. Include ALL requirements from the RFP — eligibility criteria, documents, forms, annexures
5. Use [Page X] markers from the document to populate sourcePages accurately
6. Order items logically: administrative docs first, then eligibility/financial, then technical, then forms
7. Target 8-15 items total. Merge small related items together.

EXAMPLE OUTPUT:
- name: "Cover Letter", particular: "On company letterhead, signed by authorized signatory, referencing tender number"
- name: "Drafts Fees & EMD", particular: "Demand Draft for EMD Rs. X, Tender fee DD Rs. Y, in favour of [org]"
- name: "General Documents", particular: "Registration certificate, Partnership Deed, PAN card, GST certificate, ESI/PF registration"
- name: "CA Certificate", particular: "Chartered Accountant certified turnover certificate for last 3-5 financial years"
- name: "Financial Capacity", particular: "Audited Balance Sheet & P&L for last 3 years, Net Worth certificate"
- name: "Experience Certificates", particular: "Work completion certificates, appreciation letters from past projects"
- name: "Similar Work Orders", particular: "Minimum X completed similar projects of value Rs. Y each, with work order copies"

Return ALL items needed for a complete bid submission.`,
    });

    const items = result.object.items.map((item, i) => ({
      ...item,
      id: i + 1,
      status: "pending" as const,
    }));

    return Response.json({ items });
  } catch (e) {
    console.error("Bid checklist generation failed:", e);
    return Response.json(
      { error: "Failed to generate bid checklist" },
      { status: 500 }
    );
  }
}
