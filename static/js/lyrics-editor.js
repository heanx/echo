// -*- coding: utf-8 -*-
(function () {
  function formatSeconds(value) {
    if (!Number.isFinite(value)) return "00:00";
    const minutes = Math.floor(value / 60).toString().padStart(2, "0");
    const seconds = Math.floor(value % 60).toString().padStart(2, "0");
    const hundredths = Math.floor((value % 1) * 100).toString().padStart(2, "0");
    return minutes + ":" + seconds + "." + hundredths;
  }

  function normalizeTime(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    const match = trimmed.match(/^(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?$/);
    if (!match) return trimmed;
    const minutes = match[1].padStart(2, "0");
    const seconds = match[2].padStart(2, "0");
    const fraction = match[3] ? "." + match[3].padEnd(2, "0").slice(0, 2) : "";
    return minutes + ":" + seconds + fraction;
  }

  function parseLyricsText(value) {
    const lrcLinePattern = /^\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]\s*(.*)$/;
    return String(value || "")
      .split(/\r?\n/)
      .map(function (line) {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const match = trimmed.match(lrcLinePattern);
        return match ? { time: match[1], text: match[2] || "" } : { time: "", text: trimmed };
      })
      .filter(Boolean);
  }

  function createEditor(options) {
    const rowsContainer = options.rowsContainer;
    const rawText = options.rawText;
    const addButton = options.addButton;
    const fillCurrentTimeButton = options.fillCurrentTimeButton;
    const previewAudio = options.previewAudio;
    const fileInput = options.fileInput;
    const fileHint = options.fileHint;
    let selectedRow = null;

    function serializeRows() {
      if (!rowsContainer) return "";
      return Array.from(rowsContainer.querySelectorAll("[data-lyrics-row]"))
        .map(function (row) {
          const time = normalizeTime(row.querySelector("[data-lyrics-time]").value);
          const text = row.querySelector("[data-lyrics-text]").value.trim();
          if (!time && !text) return "";
          return time ? "[" + time + "] " + text : text;
        })
        .filter(Boolean)
        .join("\n");
    }

    function syncRawText() {
      if (rawText) rawText.value = serializeRows();
    }

    function createRow(time, text) {
      const row = document.createElement("div");
      row.dataset.lyricsRow = "true";
      row.className = "lyrics-editor-row grid grid-cols-[112px_minmax(0,1fr)_40px] gap-2 py-1";

      const timeInput = document.createElement("input");
      timeInput.type = "text";
      timeInput.dataset.lyricsTime = "true";
      timeInput.placeholder = "00:12.00";
      timeInput.value = time || "";
      timeInput.className = "rounded-lg border border-zinc-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-950";

      const textInput = document.createElement("input");
      textInput.type = "text";
      textInput.dataset.lyricsText = "true";
      textInput.placeholder = "输入歌词";
      textInput.value = text || "";
      textInput.className = "rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand dark:border-zinc-700 dark:bg-zinc-950";

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "rounded-lg text-zinc-400 transition hover:bg-rose-500/10 hover:text-rose-500";
      removeButton.setAttribute("aria-label", "删除歌词行");
      removeButton.textContent = "×";

      row.append(timeInput, textInput, removeButton);
      row.addEventListener("focusin", function () {
        selectedRow = row;
        rowsContainer.querySelectorAll("[data-lyrics-row]").forEach(function (item) {
          item.classList.toggle("rounded-lg", item === row);
          item.classList.toggle("bg-brand/10", item === row);
        });
      });
      row.addEventListener("input", syncRawText);
      removeButton.addEventListener("click", function () {
        row.remove();
        if (selectedRow === row) selectedRow = null;
        syncRawText();
      });
      return row;
    }

    function render(rows) {
      if (!rowsContainer) return;
      rowsContainer.innerHTML = "";
      (rows.length ? rows : [{ time: "", text: "" }]).forEach(function (row) {
        rowsContainer.appendChild(createRow(row.time, row.text));
      });
      selectedRow = rowsContainer.querySelector("[data-lyrics-row]");
      syncRawText();
    }

    if (fileInput) {
      fileInput.addEventListener("change", function () {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.addEventListener("load", function () {
          const text = String(reader.result || "");
          if (rawText) rawText.value = text;
          render(parseLyricsText(text));
          if (fileHint) fileHint.textContent = file.name + " 已载入，可在下方继续校对。";
        });
        reader.addEventListener("error", function () {
          if (fileHint) fileHint.textContent = "歌词文件读取失败，请尝试复制文本到下方。";
        });
        reader.readAsText(file, "utf-8");
      });
    }

    if (addButton) {
      addButton.addEventListener("click", function () {
        if (!rowsContainer) return;
        const row = createRow("", "");
        rowsContainer.appendChild(row);
        selectedRow = row;
        row.querySelector("[data-lyrics-text]").focus();
        syncRawText();
      });
    }

    if (fillCurrentTimeButton) {
      fillCurrentTimeButton.addEventListener("click", function () {
        if (!rowsContainer) return;
        const row = selectedRow || rowsContainer.querySelector("[data-lyrics-row]");
        if (!row) return;
        row.querySelector("[data-lyrics-time]").value = formatSeconds(previewAudio ? previewAudio.currentTime : 0);
        syncRawText();
      });
    }

    if (rawText) {
      rawText.addEventListener("input", function () {
        render(parseLyricsText(rawText.value));
      });
      render(parseLyricsText(rawText.value));
    }

    return {
      formatSeconds,
      parseLyricsText,
      render,
      syncRawText,
    };
  }

  window.EchoLyricsEditor = {
    create: createEditor,
    formatSeconds,
    parseLyricsText,
  };
})();
