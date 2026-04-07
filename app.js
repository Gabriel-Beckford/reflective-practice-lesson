const STORAGE_KEY = "reflective-practice/current-slide";

const state = {
  slides: [],
  currentIndex: 0,
};

const ui = {
  sectionBadge: document.getElementById("sectionBadge"),
  slideProgress: document.getElementById("slideProgress"),
  slideProgressBar: document.getElementById("slideProgressBar"),
  slideTitle: document.getElementById("slideTitle"),
  slideMeta: document.getElementById("slideMeta"),
  slideBody: document.getElementById("slideBody"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
};

init().catch((error) => {
  console.error(error);
  ui.slideTitle.textContent = "Unable to load slides";
  ui.slideMeta.textContent = "Please refresh and try again.";
});

async function init() {
  const csvText = await fetch("plan.csv").then((res) => res.text());
  state.slides = normalizeSlides(parseCsv(csvText));
  state.currentIndex = getSavedIndex(state.slides.length);

  bindEvents();
  renderSlide();
}

function bindEvents() {
  ui.prevBtn.addEventListener("click", () => goToSlide(state.currentIndex - 1));
  ui.nextBtn.addEventListener("click", () => goToSlide(state.currentIndex + 1));

  window.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") goToSlide(state.currentIndex - 1);
    if (event.key === "ArrowRight") goToSlide(state.currentIndex + 1);
  });
}

function goToSlide(index) {
  const next = clamp(index, 0, state.slides.length - 1);
  if (next === state.currentIndex) return;

  state.currentIndex = next;
  localStorage.setItem(STORAGE_KEY, String(next));
  renderSlide();
}

function renderSlide() {
  const slide = state.slides[state.currentIndex];
  if (!slide) return;

  ui.sectionBadge.textContent = `Section ${slide.section || "—"}`;
  ui.slideProgress.textContent = `Slide ${state.currentIndex + 1} of ${state.slides.length}`;
  ui.slideProgressBar.max = state.slides.length;
  ui.slideProgressBar.value = state.currentIndex + 1;

  ui.slideTitle.textContent = slide.title || "Untitled Slide";
  ui.slideMeta.textContent = [
    slide.kolbPhase ? `Kolb: ${slide.kolbPhase}` : "",
    slide.id ? `ID: ${slide.id}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  ui.slideBody.replaceChildren(
    ...renderBlocks(slide).filter(Boolean),
    ...renderInteractiveElements(slide)
  );

  ui.prevBtn.disabled = state.currentIndex === 0;
  ui.nextBtn.disabled = state.currentIndex === state.slides.length - 1;
}

function renderBlocks(slide) {
  return [
    renderTextBlock("Description", slide.body),
    renderPromptBlock("User Prompt", slide.instructions),
    renderRubricBlock("Notes / Rubric", slide.notes),
  ];
}

function renderInteractiveElements(slide) {
  const elements = [];

  if (hasDropdownHint(slide)) {
    elements.push(renderDropdownInteraction(slide));
  }

  if (hasChatbotHint(slide)) {
    elements.push(renderChatbotPanel(slide));
  }

  return elements;
}

function renderTextBlock(title, text) {
  if (!text) return null;
  const block = makeBlock("block block--text", title);
  block.appendChild(makeParagraphs(text));
  return block;
}

function renderPromptBlock(title, text) {
  if (!text) return null;
  const block = makeBlock("block block--prompt", title);
  block.appendChild(makeParagraphs(text));
  return block;
}

function renderRubricBlock(title, text) {
  if (!text) return null;
  const block = makeBlock("block block--rubric", title);
  const list = document.createElement("ul");
  list.className = "rubric-list";

  splitLines(text).forEach((line) => {
    const item = document.createElement("li");
    item.textContent = line.replace(/^\*+\s*/, "");
    list.appendChild(item);
  });

  block.appendChild(list);
  return block;
}

function renderDropdownInteraction(slide) {
  const block = makeBlock("block block--dropdown", "Quick Check");
  const label = document.createElement("label");
  label.textContent = "How would you classify this step?";
  label.className = "input-label";

  const select = document.createElement("select");
  select.className = "select";
  ["Choose one", "Concrete Experience", "Reflective Observation", "Abstract Conceptualisation", "Active Experimentation"].forEach((optionText, index) => {
    const option = document.createElement("option");
    option.value = index === 0 ? "" : optionText;
    option.textContent = optionText;
    select.appendChild(option);
  });

  block.append(label, select);
  return block;
}

function renderChatbotPanel(slide) {
  const panel = makeBlock("block block--chatbot", "Chatbot Panel");
  const note = document.createElement("p");
  note.className = "chatbot-note";
  note.textContent = "This step supports AI-guided reflection. Integrate your chatbot endpoint here.";

  const textarea = document.createElement("textarea");
  textarea.rows = 3;
  textarea.placeholder = "Write a reflection prompt…";
  textarea.className = "chatbot-input";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn btn--ghost";
  button.textContent = "Send to chatbot";

  const info = document.createElement("small");
  info.textContent = `Hint source: ${slide.title}`;

  panel.append(note, textarea, button, info);
  return panel;
}

function makeBlock(className, headingText) {
  const block = document.createElement("article");
  block.className = className;

  const heading = document.createElement("h2");
  heading.textContent = headingText;
  block.appendChild(heading);

  return block;
}

function makeParagraphs(text) {
  const wrapper = document.createElement("div");
  splitParagraphs(text).forEach((paragraph) => {
    const p = document.createElement("p");
    p.textContent = paragraph;
    wrapper.appendChild(p);
  });
  return wrapper;
}

function splitParagraphs(text) {
  return text
    .split(/\n\s*\n/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function splitLines(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasDropdownHint(slide) {
  const corpus = `${slide.instructions} ${slide.notes}`.toLowerCase();
  return corpus.includes("dropdown") || corpus.includes("select");
}

function hasChatbotHint(slide) {
  const corpus = `${slide.instructions} ${slide.notes}`.toLowerCase();
  return corpus.includes("chatbot") || corpus.includes("ai");
}

function getSavedIndex(totalSlides) {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = Number.parseInt(raw ?? "", 10);
  if (Number.isNaN(parsed)) return 0;
  return clamp(parsed, 0, Math.max(0, totalSlides - 1));
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeSlides(rows) {
  return rows
    .map((row, i) => ({
      id: safe(row.Section) + "-" + (i + 1),
      section: safe(row.Section),
      title: safe(row.Name),
      body: safe(row["Description"]),
      instructions: safe(row["User Instructions"]),
      kolbPhase: safe(row["Kolb Phase"]),
      notes: safe(row["Notes"]),
    }))
    .filter((slide) => slide.title || slide.body || slide.instructions || slide.notes);
}

function safe(value) {
  return (value ?? "").replace(/\r/g, "").trim();
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      current = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    row.push(current);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((h) => h.trim().replace(/\s+/g, " "));

  return dataRows.map((dataRow) => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = dataRow[idx] ?? "";
    });
    return obj;
  });
}
