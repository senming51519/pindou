const { setupBrowserRuntime } = await import(process.env.BROWSER_CLIENT_PATH || "browser-client.mjs");
await setupBrowserRuntime({ globals: globalThis });
globalThis.browser = await agent.browsers.get("iab");
const doc = await browser.documentation();
console.log("DOC_LENGTH:" + doc.length);
console.log(doc.substring(0, 3000));
