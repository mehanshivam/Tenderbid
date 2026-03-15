import HTMLtoDOCX from "html-to-docx";

export async function POST(req: Request) {
  const { html, filename, tags } = await req.json();

  if (!html) {
    return Response.json({ error: "No HTML content provided" }, { status: 400 });
  }

  try {
    // Build tags header block if tags exist
    const tagsBlock =
      tags && tags.length > 0
        ? `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; margin-bottom:16px;">
            <tr>
              <td style="background-color:#fffbeb; border:2px solid #d97706; padding:10px 14px;">
                <p style="font-size:10pt; font-weight:bold; color:#92400e; margin:0 0 6px 0;">REQUIREMENTS FOR THIS FORM:</p>
                <ul style="margin:0; padding-left:18px;">
                  ${tags.map((t: string) => `<li style="font-size:10pt; color:#92400e; margin:2px 0;">${t}</li>`).join("")}
                </ul>
              </td>
            </tr>
          </table>`
        : "";

    const wrappedHtml = `
      <html>
        <head>
          <style>
            body {
              font-family: 'Times New Roman', serif;
              font-size: 11pt;
              line-height: 1.15;
              color: #000;
            }
            table {
              border-collapse: collapse;
              width: 100%;
              margin: 8px 0;
            }
            th, td {
              border: 1px solid #000;
              padding: 4px 6px;
              text-align: left;
              vertical-align: top;
              font-size: 10pt;
            }
            th {
              background-color: #e5e7eb;
              font-weight: bold;
            }
            h3 {
              font-size: 11pt;
              font-weight: bold;
              margin-top: 10px;
              margin-bottom: 4px;
            }
            p {
              margin: 2px 0;
              font-size: 11pt;
            }
            ol, ul {
              margin: 2px 0;
              font-size: 11pt;
            }
            li {
              margin: 1px 0;
            }
          </style>
        </head>
        <body>
          ${tagsBlock}
          <p style="text-align:center; font-size:12pt; font-weight:bold; margin-bottom:12px;">${filename || "Document"}</p>
          ${html}
        </body>
      </html>
    `;

    const docxBuffer = await HTMLtoDOCX(wrappedHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
      font: "Times New Roman",
      fontSize: 22, // 11pt in half-points
      margins: {
        top: 1134, // ~0.79 inch (2cm)
        right: 1134,
        bottom: 1134,
        left: 1134,
      },
      title: filename || "Document",
      creator: "TenderBid",
    });

    const safeName = (filename || "document").replace(/[^a-zA-Z0-9_-]/g, "_");

    return new Response(docxBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeName}.docx"`,
      },
    });
  } catch (e) {
    console.error("DOCX export failed:", e);
    return Response.json(
      { error: "Failed to generate DOCX" },
      { status: 500 }
    );
  }
}
