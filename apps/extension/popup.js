const captureButton = document.querySelector("#capture");
const saveButton = document.querySelector("#save");
const appUrlInput = document.querySelector("#appUrl");
const status = document.querySelector("#status");

chrome.storage.sync.get({ appUrl: "http://localhost:3000" }, ({ appUrl }) => { appUrlInput.value = appUrl; });

saveButton.addEventListener("click", async () => {
  const appUrl = normalizeUrl(appUrlInput.value);
  if (!appUrl) return setStatus("Enter a valid http or https address.");
  await chrome.storage.sync.set({ appUrl });
  setStatus("Workspace address saved.");
});

captureButton.addEventListener("click", async () => {
  captureButton.disabled = true;
  setStatus("Reading the visible job page…");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/i.test(tab.url || "")) throw new Error("Open a regular job page first.");
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJobPage });
    if (!result?.text || result.text.length < 80) throw new Error("Not enough job text was found. Select the description and use the right-click menu instead.");
    const { appUrl } = await chrome.storage.sync.get({ appUrl: "http://localhost:3000" });
    const target = `${normalizeUrl(appUrl)}/workspace#capture=${encodeCapture(result)}`;
    await chrome.tabs.create({ url: target });
    window.close();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not capture this page.");
    captureButton.disabled = false;
  }
});

function setStatus(message) { status.textContent = message; }
function normalizeUrl(value) {
  try { const url = new URL(value.trim()); return /^https?:$/.test(url.protocol) ? url.origin : ""; } catch { return ""; }
}
function encodeCapture(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function extractJobPage() {
  const selectors = ["[itemprop='description']", "[data-testid*='description']", "[class*='job-description']", "[class*='jobDescription']", "main", "article"];
  const candidates = selectors.flatMap((selector) => [...document.querySelectorAll(selector)]).map((node) => node.innerText?.trim() || "").filter(Boolean);
  const selected = window.getSelection()?.toString().trim() || "";
  const text = (selected.length > 80 ? selected : candidates.sort((a, b) => b.length - a.length)[0] || document.body.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 30000);
  const company = document.querySelector("[itemprop='hiringOrganization'] [itemprop='name'], [data-testid*='company'], [class*='company']")?.textContent?.trim().slice(0, 160) || "";
  const title = document.querySelector("h1, [itemprop='title']")?.textContent?.trim().slice(0, 180) || document.title.slice(0, 180);
  return { version: 1, title, company, url: location.href, text, capturedAt: new Date().toISOString() };
}
