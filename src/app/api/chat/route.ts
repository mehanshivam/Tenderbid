import { streamText, type UIMessage, convertToModelMessages } from "ai";
import { google } from "@ai-sdk/google";

const BACKEND_URL = process.env.BACKEND_URL || "http://156.67.104.82";

export async function POST(req: Request) {
  const { messages: rawMessages, tenderId, documentContext } = await req.json();

  // Fetch tender details for context
  let tenderContext = "";
  try {
    const res = await fetch(`${BACKEND_URL}/api/tenders/${encodeURIComponent(tenderId)}`);
    if (res.ok) {
      const tender = await res.json();
      tenderContext = `
TENDER DETAILS:
- Title: ${tender.title || "N/A"}
- Reference: ${tender.reference_number || "N/A"}
- Organisation: ${tender.organisation_name || "N/A"}
- Department: ${tender.department_name || "N/A"}
- State: ${tender.state_name || "N/A"}
- Category: ${tender.product_category || "N/A"}
- Type: ${tender.tender_type || tender.category || "N/A"}
- Closing Date: ${tender.closing_date || "N/A"}
- EMD Amount: ${tender.emd_amount || "N/A"}
- Tender Fee: ${tender.tender_fee || "N/A"}
- Work Description: ${tender.work_description || "N/A"}
- Form of Contract: ${tender.form_of_contract || "N/A"}
- Number of Covers: ${tender.number_of_covers || "N/A"}
      `.trim();
    }
  } catch {
    // If fetching fails, continue without tender context
  }

  const systemPrompt = `You are a tender analysis assistant for Indian government tenders. You help users understand tender documents, eligibility criteria, and prepare technical bids.

${tenderContext}

${documentContext ? `DOCUMENT CONTENT:\n${documentContext.slice(0, 30000)}` : "No document text available yet. Ask the user to select and view a PDF document to extract its content."}

Help the user understand this tender, its requirements, eligibility criteria, and assist with bid preparation. Be specific and reference details from the tender and documents when available.

IMPORTANT CITATION RULES:
- The document content above has [Page X] markers showing which page each section comes from.
- When you reference information from the document, you MUST cite the page number inline using the format [p.X] (e.g., [p.3], [p.7]).
- You can cite multiple pages for a single piece of information (e.g., [p.1] [p.3]).
- Only cite pages whose content you actually used. Do not fabricate page numbers.
- Always include at least one citation per paragraph when referencing document content.

Format your responses in clear markdown.`;

  const coreMessages = await convertToModelMessages(rawMessages as UIMessage[]);

  const result = streamText({
    model: google("gemini-2.5-flash"),
    system: systemPrompt,
    messages: coreMessages,
  });

  return result.toUIMessageStreamResponse();
}
