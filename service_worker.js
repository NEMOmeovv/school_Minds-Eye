chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "append-text-direct") {
    const inputBox = document.getElementById("input-text");
    if (inputBox) {
      inputBox.value += `\n\n${message.text}`;
    }
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // 저장된 텍스트 불러오기
  chrome.runtime.sendMessage({ action: "get-selected-text" }, (res) => {
    document.getElementById("input-text").value = res.text;
  });

  // 저장된 API 키 불러오기
  chrome.storage.local.get("userApiKey", (res) => {
    const input = document.getElementById("api-key");
    if (res.userApiKey) input.value = res.userApiKey;
  });

  // API 키 저장
  document.getElementById("save-key-button").addEventListener("click", () => {
    const key = document.getElementById("api-key").value.trim();
    if (key.startsWith("sk-")) {
      chrome.storage.local.set({ userApiKey: key }, () => {
        alert("API 키가 저장되었습니다.");
      });
    } else {
      alert("올바른 API 키 형식을 입력하세요 (sk-로 시작).");
    }
  });

  // API 키 삭제
  document.getElementById("clear-key-button").addEventListener("click", () => {
    chrome.storage.local.remove("userApiKey", () => {
      document.getElementById("api-key").value = "";
      alert("API 키가 삭제되었습니다.");
    });
  });

  // 실행 버튼
  document.getElementById("run-button").addEventListener("click", async () => {
    const text = document.getElementById("input-text").value;

    document.getElementById("summary-output").textContent = "요약 중...";
    document.getElementById("intent-output").textContent = "의도 분석 중...";
    document.getElementById("related-links").innerHTML = "링크 수집 중...";

    try {
      const summaryIntentPrompt = `
        다음 글을 읽고 아래 정보를 JSON 형식으로 반환해줘:
        - summary: 글 요약
        - intent: 글쓴이의 의도

        응답 예시:
        {
          "summary": "...",
          "intent": "..."
        }

        글: ${text}`;

      const summaryIntentResponse = await callGPT(summaryIntentPrompt);
      console.log("summary_intent_response: ", summaryIntentResponse);
      let summary = "", intent = "";
      try {
        const parsed = JSON.parse(summaryIntentResponse);
        summary = parsed.summary || "";
        intent = parsed.intent || "";
      } catch {
        const parts = summaryIntentResponse.split(/\d\.\s/).filter(Boolean);
        [summary, intent] = parts.map(p => p.trim());
      }

      document.getElementById("summary-output").textContent = summary;
      document.getElementById("intent-output").textContent = intent;

      const linkPrompt = `다음 글과 연관된 글이나 기사의 링크를 보여줘 (최대 5개) 대신 지금도 유효한 링크들만 보여줘:\n\n${text}`;
      const linkText = await callGPT(linkPrompt);
      console.log("linkText: ", linkText);
      const links = linkText.match(/https?:\/\/[^\s\n\)]+/g) || [];

      const container = document.getElementById("related-links");
      container.innerHTML = "";
      links.forEach(url => {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.textContent = url;
        container.appendChild(a);
      });

    } catch (err) {
      console.error("에러 발생:", err);
      alert("GPT 처리 중 오류: " + err.message);
    }
  });

  // 초기화
  document.getElementById("reset-button").addEventListener("click", () => {
    document.getElementById("input-text").value = "";
    document.getElementById("summary-output").textContent = "";
    document.getElementById("intent-output").textContent = "";
    document.getElementById("related-links").innerHTML = "";
  });
});

function callGPT(prompt) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "call-gpt", prompt }, (res) => {
      if (res?.success) resolve(res.content);
      else reject(new Error(res?.error || "GPT 호출 실패"));
    });
  });
}
