import HTMLtoDOCX from "html-to-docx";

export async function POST(req: Request) {
  const { html, filename } = await req.json();

  if (!html) {
    return Response.json({ error: "No HTML content provided" }, { status: 400 });
  }

  try {
    const wrappedHtml = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; font-size: 11pt; }
            table { border-collapse: collapse; width: 100%; margin: 10px 0; }
            th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
            th { background-color: #f0f0f0; font-weight: bold; }
            h3 { margin-top: 12px; margin-bottom: 6px; }
            p { margin: 4px 0; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `;

    const docxBuffer = await HTMLtoDOCX(wrappedHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      pageNumber: true,
    });

    const safeName = (filename || "document").replace(/[^a-zA-Z0-9_-]/g, "_");

    return new Response(docxBuffer as Buffer, {
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
