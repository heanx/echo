(function () {
  const lrcLinePattern = /^\[(\d{1,2}:\d{2}(?:\.\d{1,3})?)\]\s*(.*)$/;

  function formatSeconds(value) {
    if (!Number.isFinite(value)) return "00:00.00";
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
    return match[1].padStart(2, "0") + ":" + match[2].padStart(2, "0") + (match[3] ? "." + match[3].padEnd(2, "0").slice(0, 2) : "");
  }

  function parseText(value) {
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

  function create(options) {
    const editorRows = options.editorRows;
    const rawText = options.rawText;
    const previewAudio = options.previewAudio;
    const previewTime = options.previewTime;
    let selectedRow = null;

    function serializeRows() {
      if (!editorRows) return "";
      return Array.from(editorRows.querySelectorAll("[data-lyrics-row]"))
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
      row.className = "grid grid-cols-[112px_minmax(0,1fr)_40px] gap-2 py-1";

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

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "rounded-lg text-zinc-400 transition hover:bg-rose-500/10 hover:text-rose-500";
      remove.setAttribute("aria-label", "删除歌词行");
      remove.textContent = "×";

      row.append(timeInput, textInput, remove);
      row.addEventListener("focusin", function () {
        selectedRow = row;
        editorRows.querySelectorAll("[data-lyrics-row]").forEach(function (item) {
          item.classList.toggle("rounded-lg", item === row);
          item.classList.toggle("bg-brand/10", item === row);
        });
      });
      row.addEventListener("input", syncRawText);
      remove.addEventListener("click", function () {
        row.remove();
        if (selectedRow === row) selectedRow = null;
        syncRawText();
      });
      return row;
    }

    function render(rows) {
      if (!editorRows) return;
      editorRows.innerHTML = "";
      (rows.length ? rows : [{ time: "", text: "" }]).forEach(function (row) {
        editorRows.appendChild(createRow(row.time, row.text));
      });
      selectedRow = editorRows.querySelector("[data-lyrics-row]");
      syncRawText();
    }

    function addRow() {
      if (!editorRows) return;
      const row = createRow("", "");
      editorRows.appendChild(row);
      selectedRow = row;
      row.querySelector("[data-lyrics-text]").focus();
      syncRawText();
    }

    function fillCurrentTime() {
      const row = selectedRow || (editorRows && editorRows.querySelector("[data-lyrics-row]"));
      if (!row) return;
      row.querySelector("[data-lyrics-time]").value = formatSeconds(previewAudio ? previewAudio.currentTime : 0);
      syncRawText();
    }

    function loadText(value) {
      if (rawText) rawText.value = String(value || "");
      render(parseText(value));
    }

    function readFile(file, handlers) {
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener("load", function () {
        loadText(String(reader.result || ""));
        if (handlers && handlers.onLoad) handlers.onLoad(file);
      });
      reader.addEventListener("error", function () {
        if (handlers && handlers.onError) handlers.onError(file);
      });
      reader.readAsText(file, "utf-8");
    }

    if (rawText) {
      rawText.addEventListener("input", function () {
        render(parseText(rawText.value));
      });
      render(parseText(rawText.value));
    }
    if (previewAudio && previewTime) {
      previewAudio.addEventListener("timeupdate", function () {
        previewTime.textContent = formatSeconds(previewAudio.currentTime);
      });
    }
    if (options.addRowButton) options.addRowButton.addEventListener("click", addRow);
    if (options.fillCurrentTimeButton) options.fillCurrentTimeButton.addEventListener("click", fillCurrentTime);

    return {
      addRow: addRow,
      fillCurrentTime: fillCurrentTime,
      loadText: loadText,
      readFile: readFile,
      serializeRows: serializeRows,
    };
  }

  window.EchoLyricsEditor = {
    create: create,
    formatSeconds: formatSeconds,
    normalizeTime: normalizeTime,
    parseText: parseText,
  };
})();
