const { setupBrowserRuntime } = await import("C:\\Users\\彭森明\\.codex\\plugins\\cache\\openai-bundled\\browser\\26.609.41114\\scripts\\browser-client.mjs");
await setupBrowserRuntime({ globals: globalThis });
globalThis.browser = await agent.browsers.get("iab");
const doc = await browser.documentation();
console.log("DOC_LENGTH:" + doc.length);
console.log(doc.substring(0, 3000));
