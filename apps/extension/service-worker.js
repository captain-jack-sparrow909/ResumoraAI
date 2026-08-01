chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "resumora-capture", title: "Tailor with Resumora", contexts: ["page", "selection"] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "resumora-capture" || !tab?.id || !/^https?:/i.test(tab.url || "")) return;
  let capture;
  if ((info.selectionText || "").trim().length > 80) {
    capture = { version: 1, title: tab.title || "Captured job", company: "", url: tab.url || "", text: info.selectionText.trim().slice(0, 30000), capturedAt: new Date().toISOString() };
  } else {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extractJobPage });
    capture = result;
  }
  if (!capture?.text) return;
  const { appUrl } = await chrome.storage.sync.get({ appUrl: "http://localhost:3000" });
  await chrome.tabs.create({ url: `${normalizeUrl(appUrl)}/workspace#capture=${encodeCapture(capture)}` });
});

function normalizeUrl(value) { try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.origin : "http://localhost:3000"; } catch { return "http://localhost:3000"; } }
function encodeCapture(payload) { const bytes = new TextEncoder().encode(JSON.stringify(payload)); let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""); }
function extractJobPage() {
  const selectors = ["[itemprop='description']", "[data-testid*='description']", "[class*='job-description']", "[class*='jobDescription']", "main", "article"];
  const candidates = selectors.flatMap((selector) => [...document.querySelectorAll(selector)]).map((node) => node.innerText?.trim() || "").filter(Boolean);
  const text = (candidates.sort((a, b) => b.length - a.length)[0] || document.body.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 30000);
  const company = document.querySelector("[itemprop='hiringOrganization'] [itemprop='name'], [data-testid*='company'], [class*='company']")?.textContent?.trim().slice(0, 160) || "";
  const title = document.querySelector("h1, [itemprop='title']")?.textContent?.trim().slice(0, 180) || document.title.slice(0, 180);
  return { version: 1, title, company, url: location.href, text, capturedAt: new Date().toISOString() };
}
