/**
 * Volume Corrector Pro — Background Service Worker
 * Handles message routing between popup ↔ offscreen document
 * Manages tab capture via chrome.tabCapture
 */

let offscreenCreated = false;
let activeStreamId = null;
let currentTabId = null;

// ─── Create Offscreen Document ───

async function ensureOffscreenDocument() {
  if (offscreenCreated) return;

  const exists = await chrome.offscreen.hasDocument().catch(() => false);
  if (exists) {
    offscreenCreated = true;
    return;
  }

  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification:
        "Volume Corrector Pro processes tab audio in real-time using Web Audio API. This requires a dedicated audio processing context.",
    });
    offscreenCreated = true;
    console.log("[BG] Offscreen document created");
  } catch (err) {
    console.error("[BG] Failed to create offscreen document:", err);
    throw new Error("Failed to initialize audio processing engine");
  }
}

// ─── Tab Capture ───

async function captureCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.id) {
      return { success: false, error: "No active tab found" };
    }

    currentTabId = tab.id;
    console.log("[BG] Capturing tab:", tab.id, tab.title);

    const streamId = await chrome.tabCapture.getMediaStreamId({
      targetTabId: tab.id,
    });

    if (!streamId) {
      return { success: false, error: "Failed to get media stream ID" };
    }

    activeStreamId = streamId;
    return { success: true, streamId, tabId: tab.id, tabTitle: tab.title };
  } catch (err) {
    console.error("[BG] Tab capture failed:", err);
    return {
      success: false,
      error: err.message || "Failed to capture tab. Make sure the tab is playing audio.",
    };
  }
}

// ─── Message Handling ───

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("[BG] Message:", message.type);

  switch (message.type) {
    case "START_CAPTURE":
      (async () => {
        try {
          const capture = await captureCurrentTab();
          if (!capture.success) {
            sendResponse(capture);
            return;
          }

          await ensureOffscreenDocument();

          // Wait for offscreen to be ready
          await new Promise((r) => setTimeout(r, 300));

          // Forward to offscreen
          const result = await chrome.runtime.sendMessage({
            type: "SETUP_AUDIO",
            streamId: capture.streamId,
            settings: message.settings,
          });

          sendResponse({
            success: true,
            streamId: capture.streamId,
            tabTitle: capture.tabTitle,
          });
        } catch (err) {
          console.error("[BG] Start capture error:", err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // Keep message channel open for async response

    case "STOP_CAPTURE":
      (async () => {
        try {
          await chrome.runtime.sendMessage({ type: "TEARDOWN_AUDIO" });
          activeStreamId = null;
          sendResponse({ success: true });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;

    case "UPDATE_SETTINGS":
      (async () => {
        try {
          if (offscreenCreated) {
            await chrome.runtime.sendMessage({
              type: "APPLY_SETTINGS",
              settings: message.settings,
            });
          }
          sendResponse({ success: true });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;

    case "GET_STATUS":
      (async () => {
        try {
          const offscreenState = offscreenCreated
            ? await chrome.runtime.sendMessage({ type: "GET_STATE" })
            : { active: false };
          sendResponse({
            success: true,
            isActive: offscreenState?.active || false,
            streamId: activeStreamId,
            tabId: currentTabId,
          });
        } catch (err) {
          sendResponse({ success: true, isActive: false });
        }
      })();
      return true;

    case "GET_ANALYZER_DATA":
      (async () => {
        try {
          if (!offscreenCreated) {
            sendResponse({ success: true, data: null });
            return;
          }
          const result = await chrome.runtime.sendMessage({
            type: "GET_ANALYZER",
          });
          sendResponse({ success: true, data: result?.data || null });
        } catch (err) {
          sendResponse({ success: true, data: null });
        }
      })();
      return true;

    default:
      console.log("[BG] Unknown message type:", message.type);
      sendResponse({ success: false, error: "Unknown command" });
      return true;
  }
});

// Clean up when extension suspended
chrome.runtime.onSuspend.addListener(() => {
  console.log("[BG] Extension suspending, cleaning up");
  if (offscreenCreated) {
    chrome.runtime.sendMessage({ type: "TEARDOWN_AUDIO" }).catch(() => {});
  }
});

console.log("[BG] Volume Corrector Pro background service worker loaded");
