import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

const NETWORKSDB_ENDPOINT = "https://networksdb.io";
type RequestParams = Record<string, string | boolean>;

async function makeRequest(path: string, params: RequestParams = {}) {
  const apiKey = process.env.NETWORKSDB_API_KEY;
  if (!apiKey) return { error: "NETWORKSDB_API_KEY environment variable is required" };

  try {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) body.set(key, String(value));
    const response = await fetch(`${NETWORKSDB_ENDPOINT}${path}`, {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    if (!response.ok) return { error: `NetworksDB API returned ${response.status}: ${text}` };
    try { return JSON.parse(text); } catch { return { result: text }; }
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return { error: "Request timed out" };
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function toolResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

const handler = createMcpHandler(
  async (server) => {
    server.tool("key_info", "Get information about your NetworksDB API key and usage statistics.", {},
      async () => toolResult(await makeRequest("/api/key")));

    server.tool("ip_info", "Get information about an IP address.",
      { ip: z.string().optional().describe("IP address; omit to use the requester's IP when supported") },
      async ({ ip }) => toolResult(await makeRequest("/api/ip-info", ip ? { ip } : {})));

    server.tool("ip_geo", "Get geolocation information for an IP address.",
      { ip: z.string().optional().describe("IP address; omit to use the requester's IP when supported") },
      async ({ ip }) => toolResult(await makeRequest("/api/ip-geo", ip ? { ip } : {})));

    server.tool("org_search", "Search for organizations by name.",
      { query: z.string().describe("Organization name to search for") },
      async ({ query }) => toolResult(await makeRequest("/api/org-search", { search: query })));

    server.tool("org_info", "Get information about an organization.",
      { id: z.string().describe("NetworksDB organization ID") },
      async ({ id }) => toolResult(await makeRequest("/api/org-info", { id })));

    server.tool("org_networks", "Get networks belonging to an organization.",
      { id: z.string().describe("NetworksDB organization ID"), ipv6: z.boolean().optional().describe("Include IPv6 networks") },
      async ({ id, ipv6 }) => toolResult(await makeRequest("/api/org-networks", ipv6 ? { id, ipv6: true } : { id })));

    server.tool("asn_info", "Get information about an ASN.",
      { asn: z.string().describe("Autonomous System Number") },
      async ({ asn }) => toolResult(await makeRequest("/api/asn-info", { asn })));

    server.tool("asn_networks", "Get networks belonging to an ASN.",
      { asn: z.string().describe("Autonomous System Number"), ipv6: z.boolean().optional().describe("Include IPv6 networks") },
      async ({ asn, ipv6 }) => toolResult(await makeRequest("/api/asn-networks", ipv6 ? { asn, ipv6: true } : { asn })));

    server.tool("dns", "Get DNS records for a domain.",
      { domain: z.string().describe("Domain name to query") },
      async ({ domain }) => toolResult(await makeRequest("/api/dns", { domain })));

    server.tool("reverse_dns", "Get reverse DNS records for an IP address.",
      { ip: z.string().describe("IP address to query") },
      async ({ ip }) => toolResult(await makeRequest("/api/reverse-dns", { ip })));

    server.tool("mass_reverse_dns", "Get reverse DNS records for a range of IP addresses or CIDR.",
      { start: z.string().describe("CIDR block, or the first IP address when end is supplied"), end: z.string().optional().describe("Optional final IP address in the range") },
      async ({ start, end }) => toolResult(await makeRequest("/api/mass-reverse-dns", end ? { ip_start: start, ip_end: end } : { cidr: start })));
  },
  {
    capabilities: {
      tools: {
        key_info: { description: "Get NetworksDB API key information and usage statistics" },
        ip_info: { description: "Get information about an IP address" },
        ip_geo: { description: "Get geolocation information for an IP address" },
        org_search: { description: "Search for organizations by name" },
        org_info: { description: "Get information about an organization" },
        org_networks: { description: "Get networks belonging to an organization" },
        asn_info: { description: "Get information about an ASN" },
        asn_networks: { description: "Get networks belonging to an ASN" },
        dns: { description: "Get DNS records for a domain" },
        reverse_dns: { description: "Get reverse DNS records for an IP address" },
        mass_reverse_dns: { description: "Get reverse DNS records for an IP range or CIDR" },
      },
    },
  },
  { basePath: "", verboseLogs: true, maxDuration: 60, disableSse: true },
);

export { handler as GET, handler as POST, handler as DELETE };
