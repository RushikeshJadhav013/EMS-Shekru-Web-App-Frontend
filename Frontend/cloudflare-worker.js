// Cloudflare Worker to proxy HTTPS requests to HTTP backend
// Deploy this at: https://workers.cloudflare.com/

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Credentials': 'true'
  }

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    })
  }

  try {
    // Get the original URL
    const url = new URL(request.url)

    // Replace the host with your backend
    const backendUrl = `staffly.space${url.pathname}${url.search}`

    // Create new request with same method, headers, and body
    const modifiedRequest = new Request(backendUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    })

    // Fetch from backend
    const response = await fetch(modifiedRequest)

    // Create new response with CORS headers
    const modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers),
        ...corsHeaders
      }
    })

    return modifiedResponse
  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Proxy error',
      details: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    })
  }
}