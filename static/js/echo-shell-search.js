(function () {
  function create(options) {
    const echoConfig = options.echoConfig;
    const topSearchInput = options.topSearchInput;
    const topSearchClear = options.topSearchClear;
    const topSearchSuggestions = options.topSearchSuggestions;
    let abortController = null;
    let timer = 0;
    let requestId = 0;

    function searchUrlFor(query) {
      const params = new URLSearchParams();
      params.set("q", query || "");
      return (echoConfig.searchUrl || "/search/") + "?" + params.toString();
    }

    function show() {
      if (!topSearchSuggestions) return;
      topSearchSuggestions.classList.remove("hidden");
      if (topSearchInput) topSearchInput.setAttribute("aria-expanded", "true");
    }

    function hide() {
      if (!topSearchSuggestions) return;
      topSearchSuggestions.classList.add("hidden");
      if (topSearchInput) topSearchInput.setAttribute("aria-expanded", "false");
    }

    function syncClear() {
      if (!topSearchClear || !topSearchInput) return;
      const hasQuery = Boolean(topSearchInput.value.trim());
      topSearchClear.classList.toggle("hidden", !hasQuery);
      topSearchClear.classList.toggle("grid", hasQuery);
    }

    function appendSuggestionIcon(parent) {
      const icon = document.createElement("span");
      icon.className = "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300";
      icon.innerHTML = '<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
      parent.appendChild(icon);
    }

    function appendTrackCover(parent, track) {
      const cover = document.createElement("span");
      cover.className = "grid h-12 w-12 shrink-0 place-items-center rounded bg-cover bg-center text-white";
      if (track.cover_url) cover.style.backgroundImage = 'url("' + track.cover_url + '")';
      else cover.classList.add("cover-" + (track.cover_theme || "summer"));
      parent.appendChild(cover);
    }

    function render(payload) {
      if (!topSearchSuggestions || !topSearchInput) return;
      const query = (payload && payload.query) || topSearchInput.value.trim();
      topSearchSuggestions.replaceChildren();

      const header = document.createElement("div");
      header.className = "mb-1 flex items-center justify-between gap-3 px-2 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400";
      const browse = document.createElement("span");
      browse.textContent = "浏览";
      const submitHint = document.createElement("span");
      submitHint.className = "rounded border border-zinc-300 px-1.5 py-0.5 dark:border-zinc-700";
      submitHint.textContent = "回车搜索";
      header.append(browse, submitHint);
      topSearchSuggestions.appendChild(header);

      let hasContent = false;
      (payload.suggestions || []).forEach(function (suggestion) {
        hasContent = true;
        const link = document.createElement("a");
        link.className = "flex items-center gap-4 rounded-lg px-3 py-2 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800";
        link.href = searchUrlFor(suggestion);
        link.dataset.mainNav = "";
        appendSuggestionIcon(link);
        const text = document.createElement("span");
        text.className = "min-w-0 truncate text-base font-bold";
        text.textContent = suggestion;
        link.appendChild(text);
        topSearchSuggestions.appendChild(link);
      });

      (payload.tracks || []).forEach(function (track) {
        hasContent = true;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "group grid w-full grid-cols-[48px_minmax(0,1fr)_32px] items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800";
        button.dataset.echoTrack = "";
        button.dataset.id = track.id || "";
        button.dataset.src = track.audio_url || "";
        button.dataset.title = track.title || "";
        button.dataset.artist = track.artist || "Echo 用户";
        button.dataset.cover = track.cover_theme || "summer";
        button.dataset.coverUrl = track.cover_url || "";
        appendTrackCover(button, track);
        const meta = document.createElement("span");
        meta.className = "min-w-0";
        const title = document.createElement("span");
        title.className = "block truncate text-base font-bold";
        title.textContent = track.title || "未命名音频";
        const artist = document.createElement("span");
        artist.className = "block truncate text-sm text-zinc-500 dark:text-zinc-400";
        artist.textContent = "歌曲 · " + (track.artist || "Echo 用户");
        meta.append(title, artist);
        const plus = document.createElement("span");
        plus.className = "grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition group-hover:bg-zinc-200 group-hover:text-zinc-950 dark:group-hover:bg-zinc-700 dark:group-hover:text-white";
        plus.innerHTML = '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>';
        button.append(meta, plus);
        topSearchSuggestions.appendChild(button);
      });

      (payload.playlists || []).forEach(function (playlist) {
        hasContent = true;
        const link = document.createElement("a");
        link.className = "group grid w-full grid-cols-[48px_minmax(0,1fr)_32px] items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800";
        link.href = playlist.url || searchUrlFor(query);
        link.dataset.mainNav = "";
        const cover = document.createElement("span");
        cover.className = "grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-cover bg-center text-white";
        if (playlist.cover_url) cover.style.backgroundImage = 'url("' + playlist.cover_url + '")';
        else {
          cover.classList.add("cover-" + (playlist.cover_theme || "eclipse"));
          cover.textContent = "♫";
        }
        const meta = document.createElement("span");
        meta.className = "min-w-0";
        const title = document.createElement("span");
        title.className = "block truncate text-base font-bold";
        title.textContent = playlist.title || "未命名歌单";
        const details = document.createElement("span");
        details.className = "block truncate text-sm text-zinc-500 dark:text-zinc-400";
        details.textContent = "歌单 · " + (playlist.creator || "Echo 用户") + " · " + (playlist.track_count || 0) + " 首";
        meta.append(title, details);
        const arrow = document.createElement("span");
        arrow.className = "grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition group-hover:bg-zinc-200 group-hover:text-zinc-950 dark:group-hover:bg-zinc-700 dark:group-hover:text-white";
        arrow.innerHTML = '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 18l6-6-6-6"/></svg>';
        link.append(cover, meta, arrow);
        topSearchSuggestions.appendChild(link);
      });

      if (!hasContent && query) {
        const empty = document.createElement("a");
        empty.className = "flex items-center gap-4 rounded-lg px-3 py-3 transition hover:bg-zinc-100 dark:hover:bg-zinc-800";
        empty.href = searchUrlFor(query);
        empty.dataset.mainNav = "";
        appendSuggestionIcon(empty);
        const text = document.createElement("span");
        const title = document.createElement("span");
        title.className = "block font-bold";
        title.textContent = query;
        const details = document.createElement("span");
        details.className = "block text-sm text-zinc-500 dark:text-zinc-400";
        details.textContent = "查看完整搜索结果";
        text.append(title, details);
        empty.appendChild(text);
        topSearchSuggestions.appendChild(empty);
      }
      show();
    }

    function request() {
      if (!topSearchInput || !topSearchSuggestions) return;
      syncClear();
      const query = topSearchInput.value.trim();
      if (!query) {
        hide();
        topSearchSuggestions.replaceChildren();
        return;
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        const currentRequestId = ++requestId;
        if (abortController) abortController.abort();
        abortController = new AbortController();
        const url = (echoConfig.searchSuggestUrl || "/search/suggest/") + "?q=" + encodeURIComponent(query);
        fetch(url, {
          credentials: "same-origin",
          headers: { "X-Requested-With": "XMLHttpRequest" },
          signal: abortController.signal,
        })
          .then(function (response) {
            if (!response.ok) throw new Error("suggest failed");
            return response.json();
          })
          .then(function (payload) {
            if (currentRequestId === requestId) render(payload || { query: query, suggestions: [], tracks: [] });
          })
          .catch(function (error) {
            if (!error || error.name !== "AbortError") render({ query: query, suggestions: [], tracks: [] });
          });
      }, 140);
    }

    return { hide: hide, request: request, syncClear: syncClear };
  }

  window.EchoShellSearch = { create: create };
})();
