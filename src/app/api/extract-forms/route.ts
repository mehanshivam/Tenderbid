import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

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
    })
  ),
});

export async function POST(req: Request) {
  const { documentContext } = await req.json();

  if (!documentContext) {
    return Response.json(
      { error: "No document context provided" },
      { status: 400 }
    );
  }

  try {
    const result = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: formSchema,
      prompt: `You are a tender document analyst. Analyze the following tender/RFP document and extract EVERY annexure, form, declaration, affidavit, undertaking, certificate format, and bid format that a bidder must fill out and submit.

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

4. ORDERING: Extract in document order.

5. DO NOT extract the tender notice itself, instructions, or eligibility criteria — only extract fillable forms/annexures.

Return ALL forms found. If there are no forms, return an empty array.`,
    });

    return Response.json(result.object);
  } catch (e) {
    console.error("Form extraction failed:", e);
    return Response.json(
      { error: "Failed to extract forms from document" },
      { status: 500 }
    );
  }
}
