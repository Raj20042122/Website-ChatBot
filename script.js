const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggleBtn = document.querySelector("#theme-toggle-btn");

const API_KEY = "AIzaSyD6nQt1Dan4tnadVdXsLE-cYjwVr0ryp4o";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

let controller, typingInterval;
const chatHistory = [];
const userData = { message: "", file: {} };

// Finance-only query checker
function isFinanceQuery(text) {
  const financeKeywords = [
    "budget", "investment", "invest", "loan", "savings", "debt", "interest",
    "finance", "financial", "income", "expense", "money", "tax", "credit", "insurance",
    "hi", "trip"
  ];
  const lowerText = text.toLowerCase();
  return financeKeywords.some(keyword => lowerText.includes(keyword));
}

// Set initial theme from local storage
const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";

// Create message elements
const createMessageElement = (content, ...classes) => {
  const div = document.createElement("div");
  div.classList.add("message", ...classes);
  div.innerHTML = content;
  return div;
};

const scrollToBottom = () => container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });

const typingEffect = (text, textElement, botMsgDiv) => {
  textElement.textContent = "";
  const words = text.split(" ");
  let wordIndex = 0;
  typingInterval = setInterval(() => {
    if (wordIndex < words.length) {
      textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
      scrollToBottom();
    } else {
      clearInterval(typingInterval);
      botMsgDiv.classList.remove("loading");
      document.body.classList.remove("bot-responding");
    }
  }, 40);
};


const generateResponse = async (botMsgDiv) => {
  const textElement = botMsgDiv.querySelector(".message-text");
  controller = new AbortController();

  // Prepare the user's message with optional file
  const userParts = [{ text: userData.message }];
  if (userData.file.data) {
    userParts.push({
      inline_data: {
        mime_type: userData.file.mime_type,
        data: userData.file.data
      }
    });
  }

  // Add to chat history
  chatHistory.push({
    role: "user",
    parts: userParts
  });

  try {
    // Show loading state
    textElement.textContent = "Thinking...";
    botMsgDiv.classList.add("loading");
    document.body.classList.add("bot-responding");

    // API request
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: chatHistory,
        generationConfig: {
          maxOutputTokens: 600,
          temperature: 0.3,
          topP: 0.85,
          topK: 30,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_ONLY_HIGH"
          }
        ]
      }),
      signal: controller.signal
    });

    // Handle response
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "API request failed");
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error("Invalid response format from API");
    }

    // Process response text
    let responseText = data.candidates[0].content.parts[0].text
      .replace(/\*\*/g, "") // Remove bold markdown
      .trim();

    // Ensure complete sentences
    responseText = formatResponseText(responseText);

    // Display response
    typingEffect(responseText, textElement, botMsgDiv);
    
    // Update chat history
    chatHistory.push({
      role: "model",
      parts: [{ text: responseText }]
    });

  } catch (error) {
    console.error("API Error:", error);
    textElement.textContent = `Error: ${cleanErrorMessage(error.message)}`;
    textElement.style.color = "#d62939";
  } finally {
    botMsgDiv.classList.remove("loading");
    document.body.classList.remove("bot-responding");
    userData.file = {};
    scrollToBottom();
  }
};

// Helper functions
function formatResponseText(text) {
  // Ensure the response ends with proper punctuation
  if (!/[.!?]$/.test(text)) {
    const lastSentenceEnd = Math.max(
      text.lastIndexOf(". "),
      text.lastIndexOf("! "),
      text.lastIndexOf("? ")
    );
    
    if (lastSentenceEnd > 0) {
      return text.substring(0, lastSentenceEnd + 1);
    }
    return text + "...";
  }
  return text;
}

function cleanErrorMessage(msg) {
  return msg
    .replace(/^GoogleGenerativeAIError:\s*/i, "")
    .replace(/\.$/, "");
}


const handleFormSubmit = (e) => {
  e.preventDefault();
  const userMessage = promptInput.value.trim();
  if (!userMessage || document.body.classList.contains("bot-responding")) return;

  // Finance filter check
  if (!isFinanceQuery(userMessage)) {
    const warningMsg = createMessageElement(
      `<p class="message-text">❌ Sorry, I can only help with finance-related topics like budgeting, investments, savings, and loans.</p>`,
      "bot-message"
    );
    chatsContainer.appendChild(warningMsg);
    scrollToBottom();
    return;
  }

  userData.message = userMessage;
  promptInput.value = "";
  document.body.classList.add("chats-active", "bot-responding");
  fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");

  const userMsgHTML = `
    <p class="message-text"></p>
    ${userData.file.data ? (
      userData.file.isImage
        ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />`
        : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`
    ) : ""}
  `;
  const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
  userMsgDiv.querySelector(".message-text").textContent = userData.message;
  chatsContainer.appendChild(userMsgDiv);
  scrollToBottom();

  setTimeout(() => {
    const botMsgHTML = `<img class="avatar" src="images/1f4b8_color.png" /> <p class="message-text">Just a sec...</p>`;
    const botMsgDiv = createMessageElement(botMsgHTML, "bot-message", "loading");
    chatsContainer.appendChild(botMsgDiv);
    scrollToBottom();
    generateResponse(botMsgDiv);
  }, 600);
};

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const isImage = file.type.startsWith("image/");
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (e) => {
    fileInput.value = "";
    const base64String = e.target.result.split(",")[1];
    fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
    fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");
    userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage };
  };
});

document.querySelector("#cancel-file-btn").addEventListener("click", () => {
  userData.file = {};
  fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");
});

document.querySelector("#stop-response-btn").addEventListener("click", () => {
  controller?.abort();
  userData.file = {};
  clearInterval(typingInterval);
  chatsContainer.querySelector(".bot-message.loading")?.classList.remove("loading");
  document.body.classList.remove("bot-responding");
});

themeToggleBtn.addEventListener("click", () => {
  const isLightTheme = document.body.classList.toggle("light-theme");
  localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
  themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

document.querySelector("#delete-chats-btn").addEventListener("click", () => {
  chatHistory.length = 0;
  chatsContainer.innerHTML = "";
  document.body.classList.remove("chats-active", "bot-responding");
});

document.querySelectorAll(".suggestions-item").forEach((suggestion) => {
  suggestion.addEventListener("click", () => {
    promptInput.value = suggestion.querySelector(".text").textContent;
    promptForm.dispatchEvent(new Event("submit"));
  });
});

document.addEventListener("click", ({ target }) => {
  const wrapper = document.querySelector(".prompt-wrapper");
  const shouldHide = target.classList.contains("prompt-input") || (wrapper.classList.contains("hide-controls") && (target.id === "add-file-btn" || target.id === "stop-response-btn"));
  wrapper.classList.toggle("hide-controls", shouldHide);
});

promptForm.addEventListener("submit", handleFormSubmit);
promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());

