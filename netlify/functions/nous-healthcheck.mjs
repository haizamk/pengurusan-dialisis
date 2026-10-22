export default async (request) => {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), { status: 405, headers });
  }

  const testToken = process.env.NOUS_TEST_TOKEN?.trim();
  const apiKey = process.env.NOUS_API_KEY?.trim();

  if (!testToken || !apiKey) {
    return new Response(JSON.stringify({ ok: false, error: "test_not_configured" }), { status: 503, headers });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "invalid_request" }), { status: 400, headers });
  }

  if (typeof body?.token !== "string" || body.token.length < 20 || body.token !== testToken) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), { status: 401, headers });
  }

  try {
    const response = await fetch("https://inference-api.nousresearch.com/v1/models", {
      method: "GET",
      headers: { authorization: `Bearer ${apiKey}`, accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: response.status === 401 || response.status === 403 ? "nous_auth_failed" :
          response.status === 429 ? "nous_rate_limited" : "nous_api_error",
        status: response.status,
      }), { status: 502, headers });
    }

    const result = await response.json();
    const models = Array.isArray(result?.data) ? result.data : Array.isArray(result?.models) ? result.models : [];
    return new Response(JSON.stringify({ ok: true, api: "reachable", modelsListed: models.length }), { status: 200, headers });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "nous_unreachable" }), { status: 502, headers });
  }
};
