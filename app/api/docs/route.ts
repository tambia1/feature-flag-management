const SWAGGER_UI = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.34.1";

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API Docs</title>
  <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_UI}/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: "/api/docs/spec", dom_id: "#swagger-ui" });
  </script>
</body>
</html>`;

export function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
