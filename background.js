chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-text",
    title: "GPT 요약에 추가",
    contexts: ["selection"]
  });

  chrome.tabs.query({}, (tabs) => {
    for (let tab of tabs) {
      chrome.sidePanel.setOptions({
        tabId: tab.id,
        path: "sidepanel.html",
        enabled: true
      });
    }
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "add-text") {
    const newText = info.selectionText;

    chrome.sidePanel.open({ tabId: tab.id }, () => {
      chrome.runtime.sendMessage({ action: "append-text-direct", text: newText });

      chrome.storage.local.get(["selectedText"], (result) => {
        const existingText = result.selectedText || "";
        const updatedText = existingText ? `${existingText}\n\n${newText}` : newText;
        chrome.storage.local.set({ selectedText: updatedText });
      });
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 저장된 텍스트 요청
  if (message.action === "get-selected-text") {
    chrome.storage.local.get("selectedText", (data) => {
      sendResponse({ text: data.selectedText || "" });
    });
    return true;
  }

  // 단일 GPT 호출 처리
  if (message.action === "call-gpt") {
    const prompt = message.prompt;

    chrome.storage.local.get("userApiKey", (res) => {
      const apiKey = res.userApiKey;
      if (!apiKey) {
        sendResponse({ success: false, error: "OpenAI API 키가 설정되지 않았습니다." });
        return;
      }

      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
        })
      })
        .then(res => res.json())
        .then(data => {
          const reply = data.choices?.[0]?.message?.content || "";
          sendResponse({ success: true, content: reply });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
    });

    return true;
  }
});
