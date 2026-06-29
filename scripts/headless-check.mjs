// Headless end-to-end check: spawn the built site-mcp over stdio, drive it with
// a real MCP client against the live signed origin, and confirm it exposes the
// expected tools/resources and returns a verified response.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  env: { ...process.env, SITE_MCP_SIGNATURE_MODE: "off" },
});
const client = new Client({ name: "headless-check", version: "0.0.0" });
await client.connect(transport);

const tools = (await client.listTools()).tools.map((t) => t.name).sort();
const resources = (await client.listResources()).resources.map((r) => r.uri).sort();
console.log("tools:", tools.join(", "));
console.log("resources:", resources.join(", "));

const call = await client.callTool({ name: "list_posts", arguments: {} });
const meta = call._meta?.verification;
console.log("list_posts verified:", JSON.stringify(meta));
console.log("list_posts isError:", call.isError ?? false);

const read = await client.readResource({ uri: "site://profile" });
console.log("profile read verified:", JSON.stringify(read._meta?.verification));

await client.close();

const ok = tools.join() === "get_conformance,get_post,list_posts" &&
  resources.includes("site://profile") &&
  meta?.matchedSignedManifest === true &&
  !(call.isError ?? false);
console.log(ok ? "HEADLESS_OK" : "HEADLESS_FAIL");
process.exit(ok ? 0 : 1);
