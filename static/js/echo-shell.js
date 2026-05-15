// -*- coding: utf-8 -*-
    (function () {
      const root = document.documentElement;
      const echoConfig = window.EchoConfig || {};
      const toastRegion = document.getElementById("echo-toast-region");
      const topBar = document.getElementById("top-bar");
      const topSearchWrap = document.querySelector(".top-search-wrap");
      const topSearchForm = document.getElementById("top-search-form");
      const topSearchInput = document.getElementById("top-search-input");
      const topSearchClear = document.getElementById("top-search-clear");
      const topSearchSuggestions = document.getElementById("top-search-suggestions");
      const shell = document.getElementById("content-grid");
      const playbackBar = document.getElementById("playback-bar");
      const playbackControls = document.querySelector(".playback-controls");
      const playbackActions = document.querySelector(".playback-actions");
      const leftSidebar = document.getElementById("left-sidebar");
      const contextPanel = document.getElementById("context-panel");
      const themeToggle = document.getElementById("theme-toggle");
      const sidebarToggles = document.querySelectorAll("[data-toggle-sidebar]");
      const tooltipTriggers = document.querySelectorAll(".has-tooltip");
      const libraryTrigger = document.querySelector("[data-library-trigger]");
      const libraryCreate = document.querySelector(".library-create");
      const libraryCreateButton = document.querySelector("[data-library-create]");
      const libraryCreateMenu = document.querySelector(".library-create-menu");
      const closeContext = document.getElementById("close-context");
      const openPlaylist = document.getElementById("open-playlist");
      const contextViews = document.querySelectorAll("[data-context-view]");
      const contextPanelTitle = document.getElementById("context-panel-title");
      const contextCloseTooltip = document.getElementById("context-close-tooltip");
      const contextIcons = document.querySelectorAll("[data-context-icon]");
      const audio = document.getElementById("echo-audio");
      const volume = document.getElementById("player-volume");
      const progress = document.getElementById("player-progress");
      const current = document.getElementById("player-current");
      const duration = document.getElementById("player-duration");
      const title = document.getElementById("player-title");
      const artist = document.getElementById("player-artist");
      const playerStatus = document.getElementById("player-status");
      const cover = document.getElementById("player-cover");
      const sideCover = document.getElementById("side-cover");
      const sideTitle = document.getElementById("side-title");
      const sideArtist = document.getElementById("side-artist");
      const playlistTrackList = document.getElementById("playlist-track-list");
      const playlistTrackCount = document.getElementById("playlist-track-count");
      const shuffleToggle = document.getElementById("shuffle-toggle");
      const shuffleIcon = document.getElementById("shuffle-icon");
      const toggle = document.getElementById("player-toggle");
      const prevButton = document.getElementById("player-prev");
      const nextButton = document.getElementById("player-next");
      const repeatToggle = document.getElementById("repeat-toggle");
      const repeatIcon = document.getElementById("repeat-icon");
      const repeatOneBadge = document.getElementById("repeat-one-badge");
      const playIcon = document.getElementById("player-play-icon");
      const pauseIcon = document.getElementById("player-pause-icon");
      const lyricsNav = document.getElementById("lyrics-nav");
      const commentsNav = document.getElementById("comments-nav");
      const coverClasses = ["cover-summer", "cover-city", "cover-eclipse", "cover-sea", "cover-ocean", "cover-signal", "cover-sunset", "cover-forest", "cover-night"];
      const coverThemeColors = {
        summer: [248, 165, 165],
        city: [100, 116, 139],
        eclipse: [92, 84, 148],
        sea: [56, 189, 248],
        ocean: [2, 132, 199],
        signal: [15, 118, 110],
        sunset: [249, 115, 22],
        forest: [21, 128, 61],
        night: [67, 56, 202],
      };
      const contextViewLabels = { now: "正在播放", playlist: "播放列表" };
      let contextViewStack = ["now"];
      let pointerActivatedTrack = false;
      let currentTrackId = "";
      let playReportKey = "";
      let isSeeking = false;
      let pendingSeekTime = null;
      let pendingResumeTime = null;
      let pendingResumeTrackId = "";
      let lastLyricActiveIndex = -1;
      let lastUserScrollTime = 0;
      let lastAutoScrollTime = 0;
      let activeResourceAbort = null;
      let mainResourceRequestId = 0;
      let shuffleEnabled = false;
      let repeatMode = "all";
      let playQueue = [];
      let playQueueIndex = -1;
      let playQueueName = "";
      let shufflePool = [];
      let playbackHistory = [];
      let lastPersistedPlaybackSecond = -1;
      let searchSuggestAbort = null;
      let searchSuggestTimer = 0;
      let searchSuggestRequestId = 0;
      let trackContextMenu = null;
      let contextMenuTrack = null;
      let contextMenuSourceElement = null;

      var lyricDistClasses = ["lyric-dist-0", "lyric-dist-1", "lyric-dist-2", "lyric-dist-3", "lyric-dist-4", "lyric-dist-far"];

      function formatTime(value) {
        if (!Number.isFinite(value)) return "--:--";
        const minutes = Math.floor(value / 60);
        const seconds = Math.floor(value % 60).toString().padStart(2, "0");
        return minutes + ":" + seconds;
      }
      function showToast(message, tone) {
        if (!toastRegion || !message) return;
        const item = document.createElement("div");
        const colorClass = tone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/80 dark:text-rose-200"
          : "border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100";
        item.className = "pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg transition duration-200 ease-out translate-y-0 opacity-100 " + colorClass;
        item.textContent = message;
        toastRegion.appendChild(item);
        window.setTimeout(function () {
          item.classList.add("translate-y-[-4px]", "opacity-0");
          window.setTimeout(function () {
            item.remove();
          }, 220);
        }, 2600);
      }
      function setPlayerStatus(message) {
        if (!playerStatus) return;
        playerStatus.textContent = message || "";
        playerStatus.classList.toggle("hidden", !message);
      }
      function setButtonActive(button, active) {
        if (!button) return;
        button.classList.toggle("text-brand", active);
        button.classList.toggle("text-play", active);
        button.classList.toggle("text-zinc-500", !active && button !== shuffleToggle);
        if (button === repeatToggle && !active) {
          button.classList.remove("text-play");
          button.classList.add("text-zinc-500");
        }
      }
      function setTooltipText(button, text) {
        if (!button) return;
        const tooltip = button.querySelector(".echo-tooltip");
        if (tooltip) tooltip.textContent = text;
      }
      function repeatModeLabel(mode) {
        if (mode === "off") return "顺序播放";
        if (mode === "one") return "单曲循环";
        return "列表循环";
      }
      function normalizeRepeatMode(mode) {
        return mode === "one" || mode === "off" || mode === "all" ? mode : "all";
      }
      function persistPlaybackModes() {
        writePersistedValue("echo_shuffle_enabled", shuffleEnabled ? "true" : "false");
        writePersistedValue("echo_repeat_mode", repeatMode);
      }
      function persistPlaybackState(force) {
        if (!currentTrackId || !Number.isFinite(audio.currentTime)) return;
        var currentSecond = Math.max(0, Math.floor(audio.currentTime));
        if (!force && currentSecond === lastPersistedPlaybackSecond) return;
        lastPersistedPlaybackSecond = currentSecond;
        writePersistedValue("echo_current_track_id", currentTrackId);
        writePersistedValue("echo_player_time", currentSecond);
      }
      function normalizeTrack(track) {
        if (!track || !track.id) return null;
        return {
          src: track.src || "",
          id: String(track.id),
          title: track.title || "",
          artist: track.artist || "",
          cover: track.cover || "summer",
          coverUrl: track.coverUrl || "",
        };
      }
      function queueIndexForTrack(queue, trackId) {
        return queue.findIndex(function (item) {
          return item && String(item.id) === String(trackId);
        });
      }
      function persistPlayQueue() {
        writePersistedValue("echo_play_queue_name", playQueueName || "");
        writePersistedValue("echo_play_queue_index", playQueueIndex >= 0 ? String(playQueueIndex) : "-1");
        try {
          localStorage.setItem("echo_play_queue", JSON.stringify(playQueue));
        } catch (_error) {}
      }
      function createPlaylistTrackButton(track, index) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "playlist-track group grid w-full grid-cols-[26px_44px_minmax(0,1fr)_28px] items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-900";
        button.dataset.echoTrack = "";
        button.dataset.queueIndex = String(index);
        button.dataset.src = track.src || "";
        button.dataset.id = track.id || "";
        button.dataset.title = track.title || "";
        button.dataset.artist = track.artist || "Echo 用户";
        button.dataset.cover = track.cover || "summer";
        button.dataset.coverUrl = track.coverUrl || "";
        button.setAttribute("aria-label", "播放 " + (track.title || "未命名音频"));

        var indexNode = document.createElement("span");
        indexNode.className = "grid h-6 w-6 place-items-center text-xs font-bold text-zinc-500";
        var numberNode = document.createElement("span");
        numberNode.className = "playlist-track-index";
        numberNode.textContent = String(index + 1);
        var playingMark = document.createElement("span");
        playingMark.className = "playlist-playing-mark h-2 w-2 rounded-full bg-brand";
        playingMark.setAttribute("aria-hidden", "true");
        indexNode.append(numberNode, playingMark);

        var coverNode = document.createElement("span");
        coverNode.className = "cover-media h-11 w-11 rounded-lg";
        if (track.coverUrl) {
          coverNode.style.backgroundImage = "url('" + String(track.coverUrl).replace(/'/g, "\\'") + "')";
        } else {
          coverNode.classList.add("cover-" + (track.cover || "summer"));
        }

        var meta = document.createElement("span");
        meta.className = "min-w-0";
        var titleNode = document.createElement("span");
        titleNode.className = "block truncate text-sm font-bold";
        titleNode.textContent = track.title || "未命名音频";
        var artistNode = document.createElement("span");
        artistNode.className = "mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400";
        artistNode.textContent = track.artist || "Echo 用户";
        meta.append(titleNode, artistNode);

        var more = document.createElement("span");
        more.className = "grid h-7 w-7 place-items-center rounded-full text-zinc-500 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100";
        more.innerHTML = '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>';

        button.append(indexNode, coverNode, meta, more);
        return button;
      }
      function renderPlaylistQueue() {
        if (!playlistTrackList) return;
        playlistTrackList.replaceChildren();
        if (playlistTrackCount) playlistTrackCount.textContent = playQueue.length + " 首";
        if (!playQueue.length) {
          var empty = document.createElement("div");
          empty.className = "rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400";
          empty.textContent = "暂时没有可播放的作品";
          playlistTrackList.appendChild(empty);
          return;
        }
        playQueue.forEach(function (track, index) {
          var item = createPlaylistTrackButton(track, index);
          var active = index === playQueueIndex;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-current", active ? "true" : "false");
          playlistTrackList.appendChild(item);
        });
      }
      function restorePersistedPlayQueue() {
        try {
          var raw = localStorage.getItem("echo_play_queue") || "[]";
          var parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return;
          playQueue = parsed.map(normalizeTrack).filter(Boolean);
          playQueueName = readPersistedValue("echo_play_queue_name", "") || "";
          playQueueIndex = parseInt(readPersistedValue("echo_play_queue_index", "-1"), 10);
          if (!Number.isFinite(playQueueIndex)) playQueueIndex = -1;
        } catch (_error) {
          playQueue = [];
          playQueueIndex = -1;
          playQueueName = "";
        }
        if (playQueue.length) renderPlaylistQueue();
      }
      function updatePlaybackModeUI() {
        repeatMode = normalizeRepeatMode(repeatMode);
        if (audio) audio.loop = repeatMode === "one";
        if (shuffleToggle) {
          const shuffleLabel = shuffleEnabled ? "随机播放已开启" : "随机播放已关闭";
          shuffleToggle.setAttribute("aria-pressed", shuffleEnabled ? "true" : "false");
          shuffleToggle.setAttribute("aria-label", shuffleLabel);
          setTooltipText(shuffleToggle, shuffleLabel);
          setButtonActive(shuffleToggle, shuffleEnabled);
          if (!shuffleEnabled) shuffleToggle.classList.add("text-zinc-500");
          if (shuffleIcon) {
            shuffleIcon.classList.toggle("scale-110", shuffleEnabled);
            shuffleIcon.style.strokeWidth = shuffleEnabled ? "2.4" : "2";
          }
        }
        if (repeatToggle) {
          const repeatLabel = repeatModeLabel(repeatMode);
          repeatToggle.setAttribute("aria-pressed", repeatMode !== "off" ? "true" : "false");
          repeatToggle.setAttribute("aria-label", repeatLabel);
          repeatToggle.dataset.repeatMode = repeatMode;
          setTooltipText(repeatToggle, repeatLabel);
          setButtonActive(repeatToggle, repeatMode !== "off");
          repeatToggle.classList.toggle("opacity-80", repeatMode === "one");
          if (repeatOneBadge) {
            repeatOneBadge.classList.toggle("hidden", repeatMode !== "one");
          }
          if (repeatIcon) {
            repeatIcon.classList.toggle("scale-110", repeatMode === "one");
            repeatIcon.style.strokeWidth = repeatMode === "off" ? "2" : "2.4";
            repeatIcon.classList.toggle("opacity-70", repeatMode === "off");
          }
          if (repeatMode !== "off") {
            repeatToggle.classList.remove("text-zinc-500");
          }
        }
      }
      function hasUsableDuration() {
        return Number.isFinite(audio.duration) && audio.duration > 0;
      }
      function resetProgress() {
        if (!hasUsableDuration()) {
          progress.max = "100";
        }
        progress.value = "0";
        current.textContent = "00:00";
        duration.textContent = "--:--";
      }
      function syncProgressMetadata() {
        if (!hasUsableDuration()) {
          progress.max = "100";
          duration.textContent = "--:--";
          return;
        }
        progress.max = String(audio.duration);
        progress.step = "0.01";
        duration.textContent = formatTime(audio.duration);
      }
      function progressTime() {
        if (!hasUsableDuration()) return 0;
        return clampNumber(Number(progress.value) || 0, 0, audio.duration);
      }
      function previewProgressSeek() {
        if (!hasUsableDuration()) return;
        pendingSeekTime = progressTime();
        current.textContent = formatTime(pendingSeekTime);
        syncLyricsActiveLine(pendingSeekTime, false);
      }
      function commitProgressSeek() {
        if (!hasUsableDuration()) return;
        const nextTime = pendingSeekTime !== null ? pendingSeekTime : progressTime();
        audio.currentTime = nextTime;
        progress.value = String(nextTime);
        current.textContent = formatTime(nextTime);
        syncLyricsActiveLine(nextTime, false);
      }
      function syncLyricsActiveLine(timeValue, shouldScroll) {
        const lines = document.querySelectorAll(".lyrics-line[data-start-ms]");
        if (!lines.length) return;

        const activeTime = Number.isFinite(timeValue) ? timeValue : audio.currentTime;
        const currentMs = activeTime * 1000;
        let activeIndex = -1;

        for (let i = 0; i < lines.length; i += 1) {
          if (parseInt(lines[i].dataset.startMs, 10) <= currentMs) {
            activeIndex = i;
          } else {
            break;
          }
        }

        if (activeIndex === lastLyricActiveIndex) return;
        lastLyricActiveIndex = activeIndex;

        lines.forEach(function (line, index) {
          lyricDistClasses.forEach(function (cls) { line.classList.remove(cls); });
          var dist = Math.abs(index - activeIndex);
          line.classList.add(dist >= 5 ? "lyric-dist-far" : "lyric-dist-" + dist);
        });

        if (shouldScroll !== false && activeIndex >= 0) {
          var userScrolling = Date.now() - lastUserScrollTime < 1800;
          if (!userScrolling) {
            lastAutoScrollTime = Date.now();
            lines[activeIndex].scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }
      function setCover(element, name, url) {
        coverClasses.forEach(function (className) { element.classList.remove(className); });
        if (url) {
          element.style.backgroundImage = "url('" + url.replace(/'/g, "\\'") + "')";
          return;
        }
        element.style.backgroundImage = "";
        element.classList.add("cover-" + (name || "summer"));
      }
      function setPlaying(playing) {
        playIcon.classList.toggle("hidden", playing);
        pauseIcon.classList.toggle("hidden", !playing);
      }
      function getCookie(name) {
        const cookies = document.cookie ? document.cookie.split(";") : [];
        for (let index = 0; index < cookies.length; index += 1) {
          const cookie = cookies[index].trim();
          if (cookie.startsWith(name + "=")) return decodeURIComponent(cookie.slice(name.length + 1));
        }
        return "";
      }
      function setCookie(name, value, maxAgeSeconds) {
        var cookie = name + "=" + encodeURIComponent(value) + "; path=/; SameSite=Lax";
        if (Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0) {
          cookie += "; max-age=" + Math.round(maxAgeSeconds);
        }
        document.cookie = cookie;
      }
      function readPersistedValue(key, fallback) {
        var stored = "";
        try {
          stored = localStorage.getItem(key) || "";
        } catch (_error) {}
        if (stored) return stored;
        var cookieValue = getCookie(key);
        if (cookieValue) return cookieValue;
        return fallback;
      }
      function writePersistedValue(key, value, maxAgeSeconds) {
        try {
          if (value === undefined || value === null || value === "") {
            localStorage.removeItem(key);
            setCookie(key, "", 0);
            return;
          }
          localStorage.setItem(key, String(value));
        } catch (_error) {}
        if (value !== undefined && value !== null && value !== "") {
          setCookie(key, String(value), maxAgeSeconds || 31536000);
        }
      }
      shuffleEnabled = readPersistedValue("echo_shuffle_enabled", "false") === "true";
      repeatMode = normalizeRepeatMode(readPersistedValue("echo_repeat_mode", "all") || "all");
      function trackPlayUrl(trackId) {
        const template = echoConfig.trackPlayUrlTemplate || "/tracks/__track_id__/play/";
        return template.replace("__track_id__", encodeURIComponent(trackId));
      }
      function updateTrackPlayCounters(trackId, plays) {
        document.querySelectorAll("[data-track-plays]").forEach(function (node) {
          if (node.dataset.trackPlays === String(trackId)) node.textContent = plays;
        });
      }
      function reportTrackPlay() {
        if (!currentTrackId || playReportKey === currentTrackId) return;
        playReportKey = currentTrackId;
        fetch(trackPlayUrl(currentTrackId), {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "X-CSRFToken": getCookie("csrftoken") || echoConfig.csrfToken || "",
            "X-Requested-With": "XMLHttpRequest",
          },
        })
          .then(function (response) {
            if (!response.ok) throw new Error("play report failed");
            return response.json();
          })
          .then(function (payload) {
            if (payload && payload.ok) updateTrackPlayCounters(payload.track_id, payload.plays);
          })
          .catch(function () {
            playReportKey = "";
          });
      }
      function setCurrentTrack(trackId) {
        if (!trackId) return;
        var restoringTrack = pendingResumeTime !== null && String(trackId) === String(pendingResumeTrackId);
        currentTrackId = trackId;
        writePersistedValue("echo_current_track_id", trackId);
        if (!restoringTrack) {
          writePersistedValue("echo_player_time", "0");
          lastPersistedPlaybackSecond = 0;
        }

        var lyricsUrl = echoConfig.lyricsUrl + "?track=" + encodeURIComponent(trackId);
        var commentsUrl = echoConfig.commentsUrl + "?track=" + encodeURIComponent(trackId);
        if (lyricsNav) {
          lyricsNav.setAttribute("hx-get", lyricsUrl);
          lyricsNav.setAttribute("href", lyricsUrl);
        }
        if (commentsNav) {
          commentsNav.setAttribute("hx-get", commentsUrl);
          commentsNav.setAttribute("href", commentsUrl);
        }

        if (playlistTrackList) {
          playlistTrackList.querySelectorAll(".playlist-track").forEach(function (item) {
            var itemQueueIndex = parseInt(item.dataset.queueIndex || "-1", 10);
            var active = Number.isFinite(itemQueueIndex) && itemQueueIndex >= 0
              ? itemQueueIndex === playQueueIndex
              : item.dataset.id === String(trackId);
            item.classList.toggle("is-active", active);
            item.setAttribute("aria-current", active ? "true" : "false");
          });
        }
      }
      function trackFromElement(element) {
        if (!element) return null;
        return normalizeTrack({
          src: element.dataset.src,
          id: element.dataset.id,
          title: element.dataset.title,
          artist: element.dataset.artist,
          cover: element.dataset.cover,
          coverUrl: element.dataset.coverUrl,
        });
      }
      function queueTracksFromElements(elements) {
        return elements
          .map(function (element) { return trackFromElement(element); })
          .filter(function (track) { return track && track.src; });
      }
      function queueTracksFromContainer(container) {
        if (!container) return [];
        return queueTracksFromElements(Array.from(container.querySelectorAll("[data-echo-track]")));
      }
      function resolveQueueContext(trigger) {
        var container = trigger ? trigger.closest("[data-play-queue]") : null;
        var queue = container ? queueTracksFromContainer(container) : [];
        var track = trackFromElement(trigger);
        var triggerQueueIndex = trigger && trigger.dataset && trigger.dataset.queueIndex ? parseInt(trigger.dataset.queueIndex, 10) : -1;
        if ((!queue.length || queueIndexForTrack(queue, track && track.id) < 0) && playlistTrackList) {
          container = playlistTrackList;
          queue = queueTracksFromContainer(playlistTrackList);
        }
        return {
          name: container ? (container.dataset.playQueue || "") : "",
          queue: queue,
          index: Number.isFinite(triggerQueueIndex) && triggerQueueIndex >= 0 ? triggerQueueIndex : queueIndexForTrack(queue, track && track.id),
        };
      }
      function fallbackQueueTracks() {
        return queueTracksFromContainer(playlistTrackList);
      }
      function ensurePlayQueue(trackId) {
        if (playQueue.length) {
          var existingIndex = queueIndexForTrack(playQueue, trackId || currentTrackId);
          if (existingIndex >= 0) {
            playQueueIndex = existingIndex;
            return playQueue;
          }
        }
        playQueue = fallbackQueueTracks();
        playQueueIndex = queueIndexForTrack(playQueue, trackId || currentTrackId);
        if (playQueueIndex < 0 && playQueue.length) playQueueIndex = 0;
        if (!playQueueName) playQueueName = "sidebar-playlist";
        persistPlayQueue();
        renderPlaylistQueue();
        return playQueue;
      }
      function setPlayQueue(queue, currentId, queueName) {
        playQueue = Array.isArray(queue) ? queue.map(normalizeTrack).filter(Boolean) : [];
        playQueueName = queueName || "";
        playQueueIndex = queueIndexForTrack(playQueue, currentId);
        persistPlayQueue();
        renderPlaylistQueue();
        revealPlaylistContext();
      }
      function playlistTracks() {
        if (!playlistTrackList) return [];
        return Array.from(playlistTrackList.querySelectorAll(".playlist-track[data-echo-track]"));
      }
      function usablePlaylistTracks() {
        return playlistTracks().filter(function (item) {
          return item.dataset.src;
        });
      }
      function currentTrackIndex(tracks) {
        return tracks.findIndex(function (item) {
          return String(item.dataset.id) === String(currentTrackId);
        });
      }
      function rebuildShufflePool() {
        const tracks = ensurePlayQueue();
        const candidates = tracks
          .map(function (item) { return item.id; })
          .filter(function (id) { return String(id) !== String(currentTrackId); });
        for (let i = candidates.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = candidates[i];
          candidates[i] = candidates[j];
          candidates[j] = temp;
        }
        shufflePool = candidates;
      }
      function playTrackById(trackId, options) {
        const target = ensurePlayQueue(trackId).find(function (item) {
          return String(item.id) === String(trackId);
        });
        if (!target) return false;
        playTrack(target, options);
        return true;
      }
      function nextShuffleTrackId() {
        if (!shufflePool.length) {
          if (repeatMode === "off") return "";
          rebuildShufflePool();
        }
        return shufflePool.shift() || "";
      }
      function restartCurrentTrack() {
        if (!audio.src) return;
        audio.currentTime = 0;
        audio.play().catch(function () {});
      }
      function playPlaylistOffset(offset, options) {
        const tracks = ensurePlayQueue();
        if (!tracks.length) return false;

        if (shuffleEnabled) {
          if (offset < 0 && playbackHistory.length) {
            const previousTrackId = playbackHistory.pop();
            return playTrackById(previousTrackId, { rememberHistory: false, resetShufflePool: false, source: "history" });
          }
          if (offset < 0) {
            return playTrack(tracks[0], { rememberHistory: false, resetShufflePool: false, source: "history" });
          }
          const nextTrackId = nextShuffleTrackId();
          if (!nextTrackId) {
            if (repeatMode === "one") {
              restartCurrentTrack();
              return true;
            }
            setPlaying(false);
            showToast("随机播放已经到末尾了。", "info");
            return false;
          }
          return playTrackById(nextTrackId, { resetShufflePool: false, source: options && options.source ? options.source : "next" });
        }

        let currentIndex = queueIndexForTrack(tracks, currentTrackId);
        if (currentIndex < 0) currentIndex = offset > 0 ? -1 : 0;
        const nextIndex = currentIndex + offset;
        if (nextIndex < 0) {
          if (repeatMode === "all" || repeatMode === "one") {
            return playTrack(tracks[tracks.length - 1], { source: options && options.source ? options.source : "prev" });
          }
          return playTrack(tracks[0], { rememberHistory: false, source: "prev" });
        }
        if (nextIndex >= tracks.length) {
          if (repeatMode === "all" || repeatMode === "one") {
            return playTrack(tracks[0], { source: options && options.source ? options.source : "next" });
          }
          setPlaying(false);
          audio.pause();
          audio.currentTime = hasUsableDuration() ? audio.duration : audio.currentTime;
          if (options && options.source === "ended") {
              showToast("播放列表已经结束。", "info");
          }
          return false;
        }
        return playTrack(tracks[nextIndex], { source: options && options.source ? options.source : "next" });
      }
      function currentContextView() {
        return contextViewStack[contextViewStack.length - 1] || "now";
      }
      function isContextCollapsed() {
        return localStorage.getItem("echo_context_collapsed") === "true" && currentContextView() === "now";
      }
      function setContextCollapsed(collapsed) {
        localStorage.setItem("echo_context_collapsed", collapsed ? "true" : "false");
        renderContextView();
      }
      function renderContextView() {
        const activeName = currentContextView();
        const collapsed = isContextCollapsed();
        contextViews.forEach(function (panel) {
          panel.classList.toggle("is-active", panel.dataset.contextView === activeName);
        });
        if (contextPanelTitle) contextPanelTitle.textContent = contextViewLabels[activeName] || "播放侧栏";
        contextPanel.classList.toggle("is-stacked", contextViewStack.length > 1);
        contextPanel.classList.toggle("is-collapsed", collapsed);
        const iconName = contextViewStack.length > 1 ? "close" : "collapse";
        contextIcons.forEach(function (icon) {
          const visible = collapsed
            ? (icon.dataset.contextIcon === "rail" || icon.dataset.contextIcon === "expand")
            : icon.dataset.contextIcon === iconName;
          icon.classList.toggle("hidden", !visible);
        });
        if (contextCloseTooltip) {
          contextCloseTooltip.textContent = collapsed
            ? "展开播放上下文"
            : (contextViewStack.length > 1 ? "关闭当前层" : "折叠播放上下文");
        }
        closeContext.setAttribute("aria-label", contextCloseTooltip ? contextCloseTooltip.textContent : "播放上下文");
        localStorage.setItem("echo_context_view_stack", JSON.stringify(contextViewStack));
        updateShellLayout();
      }
      function resetContextStack(name) {
        contextViewStack = [name || "now"];
        renderContextView();
      }
      function pushContextView(name) {
        const nextName = name || "now";
        localStorage.setItem("echo_context_collapsed", "false");
        if (currentContextView() !== nextName) contextViewStack.push(nextName);
        renderContextView();
      }
      function popContextView() {
        if (contextViewStack.length > 1) {
          contextViewStack.pop();
          renderContextView();
          return true;
        }
        return false;
      }
      function revealPlaylistContext() {
        pushContextView("playlist");
        applyContext(true);
      }
      function syncMainResourceState() {
        var main = document.getElementById("main-content");
        if (!main) return;
        var hasLyrics = main.querySelector("[data-echo-resource='lyrics']");
        main.classList.toggle("lyrics-scroll", Boolean(hasLyrics));
      }
      function clampChannel(value) {
        return Math.max(0, Math.min(255, Math.round(value)));
      }
      function rgbToCss(rgb) {
        return "rgb(" + rgb[0] + ", " + rgb[1] + ", " + rgb[2] + ")";
      }
      function coverColorCacheKey(imageUrl) {
        return "echo_cover_color:" + imageUrl;
      }
      function readCachedCoverColor(imageUrl) {
        if (!imageUrl) return null;
        try {
          var cached = localStorage.getItem(coverColorCacheKey(imageUrl));
          if (!cached) return null;
          var parsed = JSON.parse(cached);
          if (!Array.isArray(parsed) || parsed.length !== 3) return null;
          return parsed.map(clampChannel);
        } catch (error) {
          return null;
        }
      }
      function writeCachedCoverColor(imageUrl, rgb) {
        if (!imageUrl || !rgb) return;
        try {
          localStorage.setItem(coverColorCacheKey(imageUrl), JSON.stringify(rgb.map(clampChannel)));
        } catch (error) {}
      }
      function mixRgb(rgb, target, amount) {
        return [
          clampChannel(rgb[0] + (target[0] - rgb[0]) * amount),
          clampChannel(rgb[1] + (target[1] - rgb[1]) * amount),
          clampChannel(rgb[2] + (target[2] - rgb[2]) * amount),
        ];
      }
      function themeBaseColor(themeName) {
        return coverThemeColors[themeName] || coverThemeColors.summer;
      }
      function applyLyricsPanelTheme(panel, rgb) {
        if (!panel || !rgb) return;
        var isDark = root.classList.contains("dark");
        var adjusted = isDark ? mixRgb(rgb, [0, 0, 0], 0.10) : mixRgb(rgb, [255, 255, 255], 0.10);
        var deep = mixRgb(adjusted, isDark ? [0, 0, 0] : [255, 255, 255], isDark ? 0.24 : 0.16);
        panel.style.setProperty("--lyrics-surface", rgbToCss(adjusted));
        panel.style.setProperty("--lyrics-surface-soft", rgbToCss(deep));
      }
      function readImageDominantColor(imageUrl) {
        return new Promise(function (resolve, reject) {
          if (!imageUrl) {
            reject(new Error("missing image"));
            return;
          }
          var image = new Image();
          image.crossOrigin = "anonymous";
          image.onload = function () {
            try {
              var canvas = document.createElement("canvas");
              var context = canvas.getContext("2d", { willReadFrequently: true });
              var width = Math.max(1, Math.min(32, image.naturalWidth || image.width));
              var height = Math.max(1, Math.min(32, image.naturalHeight || image.height));
              canvas.width = width;
              canvas.height = height;
              context.drawImage(image, 0, 0, width, height);
              var data = context.getImageData(0, 0, width, height).data;
              var red = 0;
              var green = 0;
              var blue = 0;
              var count = 0;
              for (var index = 0; index < data.length; index += 4) {
                var alpha = data[index + 3];
                if (alpha < 32) continue;
                red += data[index];
                green += data[index + 1];
                blue += data[index + 2];
                count += 1;
              }
              if (!count) {
                reject(new Error("empty image"));
                return;
              }
              resolve([
                clampChannel(red / count),
                clampChannel(green / count),
                clampChannel(blue / count),
              ]);
            } catch (error) {
              reject(error);
            }
          };
          image.onerror = function () {
            reject(new Error("image load failed"));
          };
          image.src = imageUrl;
        });
      }
      function syncLyricsPanelTheme() {
        var panel = document.querySelector(".lyrics-panel[data-echo-resource='lyrics']");
        if (!panel) return;
        var fallback = themeBaseColor(panel.dataset.coverTheme || "summer");
        applyLyricsPanelTheme(panel, fallback);
        var coverUrl = panel.dataset.coverUrl || "";
        if (!coverUrl) return;
        var cached = readCachedCoverColor(coverUrl);
        if (cached) {
          applyLyricsPanelTheme(panel, cached);
        }
        readImageDominantColor(coverUrl)
          .then(function (rgb) {
            writeCachedCoverColor(coverUrl, rgb);
            applyLyricsPanelTheme(panel, rgb);
          })
          .catch(function () {
            applyLyricsPanelTheme(panel, cached || fallback);
          });
      }
      function cancelActiveResourceLoad() {
        mainResourceRequestId += 1;
        if (activeResourceAbort) {
          activeResourceAbort.abort();
          activeResourceAbort = null;
        }
      }
      function extractMainContent(doc) {
        const shellMain = doc.querySelector("#echo-shell #content-grid > section > #main-content");
        const nextMain = shellMain || doc.querySelector("#main-content");
        if (!nextMain) return null;

        const cleanMain = nextMain.cloneNode(true);
        cleanMain.querySelectorAll("#echo-shell, #content-grid, #main-content").forEach(function (node) {
          if (node !== cleanMain) node.remove();
        });
        return cleanMain;
      }
      function loadMainResource(resourceName, trackId) {
        if (!resourceName || !trackId) return;
        cancelActiveResourceLoad();
        const baseUrl = resourceName === "comments" ? echoConfig.commentsUrl : echoConfig.lyricsUrl;
        const url = baseUrl + "?track=" + encodeURIComponent(trackId);
        const controller = new AbortController();
        const requestId = mainResourceRequestId;
        activeResourceAbort = controller;
        fetch(url, { cache: "no-store", headers: { "HX-Request": "true" }, signal: controller.signal })
          .then(function (response) { return response.text(); })
          .then(function (html) {
            if (controller.signal.aborted) return;
            if (requestId !== mainResourceRequestId) return;
            if (String(currentTrackId) !== String(trackId)) return;
            const doc = new DOMParser().parseFromString(html, "text/html");
            const nextMain = extractMainContent(doc);
            const currentMain = document.getElementById("main-content");
            if (nextMain && currentMain) {
              currentMain.outerHTML = nextMain.outerHTML;
              syncMainResourceState();
              syncLyricsPanelTheme();
              history.pushState({}, "", url);
            }
          })
          .catch(function (error) {
            if (error && error.name === "AbortError") return;
            showToast("内容加载失败，请稍后再试。", "error");
          })
          .finally(function () {
            if (activeResourceAbort === controller) activeResourceAbort = null;
          });
      }
      function refreshActiveResource(trackId) {
        if (!trackId) return;
        const activeResource = document.querySelector("#main-content [data-echo-resource]");
        if (!activeResource) return;
        loadMainResource(activeResource.dataset.echoResource, trackId);
      }
      function mainContentHasDirtyForm() {
        const dirtyForms = document.querySelectorAll("#main-content form[data-echo-dirty='true']");
        return Array.from(dirtyForms).some(function (form) {
          return Array.from(form.elements).some(function (field) {
            if (!field.name || field.disabled) return false;
            if (field.type === "hidden" || field.type === "submit" || field.type === "button") return false;
            if (field.type === "file") return field.files && field.files.length > 0;
            if (field.type === "checkbox" || field.type === "radio") return field.checked;
            return String(field.value || "").trim().length > 0;
          });
        });
      }
      function clearMainContentDirtyState() {
        document.querySelectorAll("#main-content form[data-echo-dirty='true']").forEach(function (form) {
          form.dataset.echoDirty = "false";
        });
      }
      function resetMainContentToHome() {
        if (mainContentHasDirtyForm()) {
          const ok = window.confirm("当前页面有未保存的编辑内容，确定要回到首页吗？");
          if (!ok) return false;
        }
        setCreateMenu(false);
        fetch(echoConfig.homeUrl, { cache: "no-store", headers: { "HX-Request": "true" } })
          .then(function (response) { return response.text(); })
          .then(function (html) {
            const doc = new DOMParser().parseFromString(html, "text/html");
            const nextMain = doc.querySelector("#main-content");
            const currentMain = document.getElementById("main-content");
            if (!nextMain || !currentMain) {
              window.location.href = echoConfig.homeUrl;
              return;
            }
            currentMain.outerHTML = nextMain.outerHTML;
            clearMainContentDirtyState();
            history.pushState({}, "", echoConfig.homeUrl);
          })
          .catch(function () {
            showToast("首页加载失败，已为你切回完整页面。", "error");
            window.location.href = echoConfig.homeUrl;
          });
        return false;
      }
      function applyTheme(theme) {
        var normalizedTheme = theme === "light" ? "light" : "dark";
        root.classList.toggle("dark", normalizedTheme !== "light");
        root.dataset.echoTheme = normalizedTheme;
        writePersistedValue("echo_theme", normalizedTheme);
        syncLyricsPanelTheme();
      }
      function clampNumber(value, min, max) {
        return Math.max(min, Math.min(max, value));
      }
      function updateShellLayout() {
        if (!shell || !leftSidebar || !contextPanel) return;
        const viewportWidth = document.documentElement.clientWidth;
        const sidebarCollapsed = localStorage.getItem("echo_sidebar_collapsed") === "true";
        const contextWanted = true;
        const contextCollapsed = isContextCollapsed();
        const showLeft = viewportWidth >= 760;
        const leftWidth = showLeft
          ? (sidebarCollapsed ? 76 : Math.round(clampNumber(viewportWidth * 0.22, 248, 320)))
          : 0;
        const roomAfterLeft = viewportWidth - leftWidth;
        const rightCandidate = contextCollapsed ? 76 : Math.round(clampNumber(viewportWidth * 0.2, 248, 360));
        const showContext = contextWanted && showLeft && roomAfterLeft - rightCandidate >= 560;
        const rightWidth = showContext ? rightCandidate : 0;
        shell.style.setProperty("--left-width", leftWidth + "px");
        shell.style.setProperty("--right-width", rightWidth + "px");
        shell.style.gridTemplateColumns = [
          showLeft ? "var(--left-width)" : "",
          "minmax(0, 1fr)",
          showContext ? "var(--right-width)" : "",
        ].filter(Boolean).join(" ");
        shell.classList.toggle("layout-has-left", showLeft);
        shell.classList.toggle("layout-no-left", !showLeft);
        shell.classList.toggle("layout-has-context", showContext);
        shell.classList.toggle("layout-no-context", !showContext);
        shell.classList.toggle("context-closed", !showContext);
        leftSidebar.classList.toggle("is-compact", showLeft && !sidebarCollapsed && leftWidth < 280);
        contextPanel.style.display = showContext ? "" : "none";
        if (openPlaylist) {
          openPlaylist.setAttribute("aria-pressed", showContext ? "true" : "false");
          openPlaylist.classList.toggle("text-brand", showContext && currentContextView() === "playlist");
        }
      }
      function applySidebar(collapsed) {
        leftSidebar.classList.toggle("is-collapsed", collapsed);
        if (libraryTrigger) libraryTrigger.setAttribute("aria-label", collapsed ? "展开音乐库" : "音乐库");
        localStorage.setItem("echo_sidebar_collapsed", collapsed ? "true" : "false");
        updateShellLayout();
        queueTopSearchLayout();
      }
      function setCreateMenu(open) {
        if (!libraryCreate || !libraryCreateButton) return;
        libraryCreate.classList.toggle("is-open", open);
        leftSidebar.classList.toggle("create-open", open);
        libraryCreateButton.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) positionCreateMenu();
      }
      function positionCreateMenu() {
        if (!libraryCreateButton || !libraryCreateMenu) return;
        const gap = 12;
        const margin = 12;
        const preferredWidth = 420;
        const buttonRect = libraryCreateButton.getBoundingClientRect();
        const sidebarRect = leftSidebar.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth;
        const menuWidth = Math.min(preferredWidth, Math.max(280, viewportWidth - margin * 2));
        const isCollapsed = leftSidebar.classList.contains("is-collapsed");
        const rightOpeningLeft = (isCollapsed ? sidebarRect.right : buttonRect.right) + gap;
        const rightOpeningFits = rightOpeningLeft + menuWidth <= viewportWidth - margin;
        const left = rightOpeningFits
          ? rightOpeningLeft
          : Math.max(margin, Math.min(sidebarRect.right - menuWidth, viewportWidth - menuWidth - margin));
        libraryCreateMenu.style.setProperty("--create-menu-left", Math.round(left) + "px");
        libraryCreateMenu.style.setProperty("--create-menu-top", Math.round(buttonRect.bottom + gap) + "px");
        libraryCreateMenu.style.setProperty("--create-menu-width", Math.round(menuWidth) + "px");
      }
      function applyContext(open) {
        localStorage.setItem("echo_context_panel_open", "true");
        updateShellLayout();
        queueTopSearchLayout();
      }
      function updateTopSearchLayout() {
        if (!topBar || !topSearchWrap) return;
        const gap = 16;
        const barRect = topBar.getBoundingClientRect();
        const logoRect = topBar.firstElementChild.getBoundingClientRect();
        const actionsRect = topBar.lastElementChild.getBoundingClientRect();
        const wrapLeft = barRect.left + topSearchWrap.offsetLeft;
        const wrapWidth = topSearchWrap.offsetWidth;
        const clusterWidth = Math.min(720, wrapWidth);
        const centerX = barRect.left + barRect.width / 2;
        const wrapCenterX = wrapLeft + wrapWidth / 2;
        const desiredShift = centerX - wrapCenterX;
        const minShift = logoRect.right + gap - (wrapCenterX - clusterWidth / 2);
        const maxShift = actionsRect.left - gap - (wrapCenterX + clusterWidth / 2);
        const shift = minShift <= maxShift ? clampNumber(desiredShift, minShift, maxShift) : 0;
        topSearchWrap.style.setProperty("--top-search-shift", Math.round(shift) + "px");
      }
      function queueTopSearchLayout() {
        requestAnimationFrame(function () {
          updateTopSearchLayout();
          requestAnimationFrame(updateTopSearchLayout);
        });
      }
      function updatePlaybackLayout() {
        if (!playbackBar || !playbackControls) return;
        const controlsWidth = playbackControls.offsetWidth;
        const viewportWidth = document.documentElement.clientWidth;
        const progressPadding = viewportWidth < 640 ? 12 : 88;
        const progressWidth = clampNumber(Math.round(controlsWidth - progressPadding), 128, 520);
        const actionWidth = playbackActions ? playbackActions.offsetWidth : 0;
        const volumeWidth = clampNumber(Math.round(actionWidth * 0.32), 56, 128);
        playbackBar.style.setProperty("--player-progress-width", progressWidth + "px");
        playbackBar.style.setProperty("--player-volume-width", volumeWidth + "px");
      }
      function queuePlaybackLayout() {
        requestAnimationFrame(function () {
          updatePlaybackLayout();
          requestAnimationFrame(updatePlaybackLayout);
        });
      }
      function updateTooltipDirection(trigger) {
        const tooltip = trigger.querySelector(".echo-tooltip");
        if (!tooltip) return;
        trigger.classList.remove("tooltip-flip-left");
        const margin = 8;
        const viewportWidth = document.documentElement.clientWidth;
        const rect = tooltip.getBoundingClientRect();
        if (rect.right > viewportWidth - margin) {
          trigger.classList.add("tooltip-flip-left");
        }
      }
      function selectTrack(track) {
        if (!track) return;
        var restoringTrack = pendingResumeTime !== null && String(track.id || "") === String(pendingResumeTrackId);
        setCurrentTrack(track.id || "");
        playReportKey = "";
        lastLyricActiveIndex = -1;
        resetProgress();
        if (restoringTrack) {
          current.textContent = formatTime(pendingResumeTime);
          progress.value = String(pendingResumeTime);
        }
        setPlayerStatus("");
        title.textContent = track.title || "未命名音频";
        artist.textContent = track.artist || "Echo 用户";
        sideTitle.textContent = title.textContent;
        sideArtist.textContent = artist.textContent;
        setCover(cover, track.cover || "summer", track.coverUrl || "");
        setCover(sideCover, track.cover || "summer", track.coverUrl || "");
        refreshActiveResource(track.id);
        if (track.src) {
          audio.src = track.src;
          audio.loop = repeatMode === "one";
        }
      }
      function playTrack(track, options) {
        const playbackOptions = options || {};
        var normalizedTrack = normalizeTrack(track);
        if (!normalizedTrack) return false;
        if (playbackOptions.rememberHistory !== false && currentTrackId && track && String(track.id) !== String(currentTrackId)) {
          playbackHistory.push(String(currentTrackId));
          if (playbackHistory.length > 50) playbackHistory = playbackHistory.slice(-50);
        }
        if (Array.isArray(playbackOptions.queue) && playbackOptions.queue.length) {
          setPlayQueue(playbackOptions.queue, normalizedTrack.id, playbackOptions.queueName || "");
          if (Number.isFinite(playbackOptions.queueIndex) && playbackOptions.queueIndex >= 0 && playbackOptions.queueIndex < playQueue.length) {
            playQueueIndex = playbackOptions.queueIndex;
            persistPlayQueue();
            renderPlaylistQueue();
          }
        } else if (!playQueue.length) {
          ensurePlayQueue(normalizedTrack.id);
        } else {
          if (Number.isFinite(playbackOptions.queueIndex) && playbackOptions.queueIndex >= 0 && playbackOptions.queueIndex < playQueue.length) {
            playQueueIndex = playbackOptions.queueIndex;
          } else {
            playQueueIndex = queueIndexForTrack(playQueue, normalizedTrack.id);
          }
          if (playQueueIndex >= 0) {
            persistPlayQueue();
            renderPlaylistQueue();
          }
        }
        selectTrack(normalizedTrack);
        if (playbackOptions.resetShufflePool !== false) {
          rebuildShufflePool();
        }
        if (normalizedTrack.src) {
          audio.play().catch(function () {});
        }
        setPlaying(true);
        return true;
      }
      function removeTrackFromPlayQueue(trackOrIndex) {
        var removeIndex = Number.isFinite(trackOrIndex) ? trackOrIndex : queueIndexForTrack(playQueue, trackOrIndex);
        if (removeIndex < 0) return false;
        playQueue.splice(removeIndex, 1);
        if (removeIndex < playQueueIndex) {
          playQueueIndex -= 1;
        } else if (removeIndex === playQueueIndex) {
          playQueueIndex = queueIndexForTrack(playQueue, currentTrackId);
        }
        if (playQueueIndex < 0 && playQueue.length) playQueueIndex = 0;
        persistPlayQueue();
        renderPlaylistQueue();
        rebuildShufflePool();
        revealPlaylistContext();
        return true;
      }
      function insertTrackInPlayQueue(track, index) {
        var normalizedTrack = normalizeTrack(track);
        if (!normalizedTrack) return false;
        var targetIndex = clampNumber(index, 0, playQueue.length);
        playQueue.splice(targetIndex, 0, normalizedTrack);
        if (playQueueIndex < 0) {
          playQueueIndex = queueIndexForTrack(playQueue, currentTrackId);
        }
        persistPlayQueue();
        renderPlaylistQueue();
        revealPlaylistContext();
        rebuildShufflePool();
        return true;
      }
      function addTrackToQueue(track) {
        if (!playQueue.length) ensurePlayQueue(currentTrackId || (track && track.id) || "");
        if (insertTrackInPlayQueue(track, playQueue.length)) {
          showToast("已加入播放队列。", "info");
        }
      }
      function playTrackNext(track) {
        if (!playQueue.length) ensurePlayQueue(currentTrackId || (track && track.id) || "");
        var currentIndex = queueIndexForTrack(playQueue, currentTrackId);
        var insertIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
        if (insertTrackInPlayQueue(track, insertIndex)) {
          showToast("已设为下一首播放。", "info");
        }
      }
      function trackIsInPlayQueue(trackId) {
        return queueIndexForTrack(playQueue, trackId) >= 0;
      }
      function resolveTrackMenuKind(trigger) {
        if (!trigger) return "browse";
        var menuScope = trigger.closest("[data-context-menu-kind]");
        if (menuScope && menuScope.dataset.contextMenuKind) return menuScope.dataset.contextMenuKind;
        if (trigger.closest("#playlist-track-list")) return "queue";
        var queueScope = trigger.closest("[data-play-queue]");
        if (!queueScope) return "browse";
        var queueName = queueScope.dataset.playQueue || "";
        if (queueName === "track-detail") return "detail";
        if (queueName.indexOf("search") === 0) return "search";
        if (queueName === "recent-tracks") return "history";
        if (queueName === "sidebar-playlist") return "queue";
        return "browse";
      }
      function buildTrackContextMenuActions(track, trigger) {
        var kind = resolveTrackMenuKind(trigger);
        var inQueue = trackIsInPlayQueue(track && track.id);
        var queueContext = resolveQueueContext(trigger);
        var queueItemIndex = trigger && trigger.dataset && trigger.dataset.queueIndex ? parseInt(trigger.dataset.queueIndex, 10) : -1;
        var playIcon = '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7L8 5Z"/></svg>';
        var nextIcon = '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg>';
        var queueIcon = '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h11"/><path d="M4 12h11"/><path d="M4 17h7"/><path d="M18 10v8"/><path d="M14 14h8"/></svg>';
        var removeIcon = '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>';
        var detailIcon = '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v5h1"/></svg>';
        var actions = [
          {
            label: kind === "detail" ? "播放这首" : "立即播放",
            icon: playIcon,
            action: function () {
              playTrack(track, {
                source: "context-menu",
                queue: queueContext.queue && queueContext.queue.length ? queueContext.queue : playQueue,
                queueName: queueContext.name || playQueueName,
                queueIndex: queueContext.index,
              });
            },
          },
          {
            label: kind === "queue" ? "移到下一首播放" : "下一首播放",
            icon: nextIcon,
            action: function () {
              playTrackNext(track);
            },
          },
        ];
        if (kind === "queue" || inQueue) {
          actions.push({
            label: "从播放队列移除",
            icon: removeIcon,
            action: function () {
              var removeTarget = Number.isFinite(queueItemIndex) && queueItemIndex >= 0 ? queueItemIndex : track.id;
              if (removeTrackFromPlayQueue(removeTarget)) showToast("已从播放队列移除。", "info");
            },
          });
        } else {
          actions.push({
            label: "加入播放队列",
            icon: queueIcon,
            action: function () {
              addTrackToQueue(track);
            },
          });
        }
        if (kind !== "detail") {
          actions.push({ separator: true });
          actions.push({
            label: "查看歌曲",
            icon: detailIcon,
            action: function () {
              window.location.href = "/tracks/" + encodeURIComponent(track.id) + "/";
            },
          });
        }
        return actions;
      }
      function contextMenuItem(label, icon, action) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-700";
        button.innerHTML = '<span class="grid h-5 w-5 shrink-0 place-items-center text-zinc-500 dark:text-zinc-300">' + icon + '</span><span class="min-w-0 truncate"></span>';
        button.querySelector("span:last-child").textContent = label;
        button.addEventListener("click", function () {
          hideTrackContextMenu();
          action();
        });
        return button;
      }
      function ensureTrackContextMenu() {
        if (trackContextMenu) return trackContextMenu;
        trackContextMenu = document.createElement("div");
        trackContextMenu.id = "track-context-menu";
        trackContextMenu.className = "fixed z-[1500] hidden w-64 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-950 shadow-soft dark:border-zinc-700 dark:bg-zinc-800 dark:text-white";
        trackContextMenu.setAttribute("role", "menu");
        document.body.appendChild(trackContextMenu);
        return trackContextMenu;
      }
      function hideTrackContextMenu() {
        if (trackContextMenu) trackContextMenu.classList.add("hidden");
        contextMenuTrack = null;
        contextMenuSourceElement = null;
      }
      function showTrackContextMenu(event, trigger) {
        var track = trackFromElement(trigger);
        if (!track) return;
        event.preventDefault();
        contextMenuTrack = track;
        contextMenuSourceElement = trigger;
        var menu = ensureTrackContextMenu();
        menu.replaceChildren();

        buildTrackContextMenuActions(contextMenuTrack, contextMenuSourceElement).forEach(function (item) {
          if (item.separator) {
            var separator = document.createElement("div");
            separator.className = "my-1 border-t border-zinc-200 dark:border-zinc-700";
            menu.appendChild(separator);
            return;
          }
          menu.appendChild(contextMenuItem(item.label, item.icon, item.action));
        });

        menu.classList.remove("hidden");
        var rect = menu.getBoundingClientRect();
        var margin = 8;
        var left = Math.min(event.clientX, window.innerWidth - rect.width - margin);
        var top = Math.min(event.clientY, window.innerHeight - rect.height - margin);
        menu.style.left = Math.max(margin, left) + "px";
        menu.style.top = Math.max(margin, top) + "px";
      }

      function searchUrlFor(query) {
        var params = new URLSearchParams();
        params.set("q", query || "");
        return (echoConfig.searchUrl || "/search/") + "?" + params.toString();
      }
      function showTopSearchSuggestions() {
        if (!topSearchSuggestions) return;
        topSearchSuggestions.classList.remove("hidden");
        if (topSearchInput) topSearchInput.setAttribute("aria-expanded", "true");
      }
      function hideTopSearchSuggestions() {
        if (!topSearchSuggestions) return;
        topSearchSuggestions.classList.add("hidden");
        if (topSearchInput) topSearchInput.setAttribute("aria-expanded", "false");
      }
      function syncTopSearchClear() {
        if (!topSearchClear || !topSearchInput) return;
        topSearchClear.classList.toggle("hidden", !topSearchInput.value.trim());
        topSearchClear.classList.toggle("grid", Boolean(topSearchInput.value.trim()));
      }
      function appendSuggestionIcon(parent) {
        var icon = document.createElement("span");
        icon.className = "grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300";
        icon.innerHTML = '<svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
        parent.appendChild(icon);
      }
      function appendTrackCover(parent, track) {
        var coverNode = document.createElement("span");
        coverNode.className = "grid h-12 w-12 shrink-0 place-items-center rounded bg-cover bg-center text-white";
        if (track.cover_url) {
          coverNode.style.backgroundImage = "url('" + String(track.cover_url).replace(/'/g, "\\'") + "')";
        } else {
          coverNode.classList.add("cover-" + (track.cover_theme || "summer"));
        }
        parent.appendChild(coverNode);
      }
      function renderTopSearchSuggestions(payload) {
        if (!topSearchSuggestions || !topSearchInput) return;
        var query = (payload && payload.query) || topSearchInput.value.trim();
        topSearchSuggestions.replaceChildren();

        var header = document.createElement("div");
        header.className = "mb-1 flex items-center justify-between gap-3 px-2 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400";
        var browse = document.createElement("span");
        browse.textContent = "浏览";
        var submitHint = document.createElement("span");
        submitHint.className = "rounded border border-zinc-300 px-1.5 py-0.5 dark:border-zinc-700";
        submitHint.textContent = "回车搜索";
        header.append(browse, submitHint);
        topSearchSuggestions.appendChild(header);

        var hasContent = false;
        (payload.suggestions || []).forEach(function (suggestion) {
          hasContent = true;
          var link = document.createElement("a");
          link.className = "flex items-center gap-4 rounded-lg px-3 py-2 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800";
          link.href = searchUrlFor(suggestion);
          appendSuggestionIcon(link);
          var text = document.createElement("span");
          text.className = "min-w-0 truncate text-base font-bold";
          text.textContent = suggestion;
          link.appendChild(text);
          topSearchSuggestions.appendChild(link);
        });

        (payload.tracks || []).forEach(function (track) {
          hasContent = true;
          var button = document.createElement("button");
          button.type = "button";
          button.className = "group grid w-full grid-cols-[48px_minmax(0,1fr)_32px] items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800";
          button.dataset.echoTrack = "";
          button.dataset.src = track.audio_url || "";
          button.dataset.id = track.id || "";
          button.dataset.title = track.title || "";
          button.dataset.artist = track.artist || "Echo 用户";
          button.dataset.cover = track.cover_theme || "summer";
          button.dataset.coverUrl = track.cover_url || "";
          appendTrackCover(button, track);
          var meta = document.createElement("span");
          meta.className = "min-w-0";
          var titleNode = document.createElement("span");
          titleNode.className = "block truncate text-base font-bold";
          titleNode.textContent = track.title || "未命名音频";
          var artistNode = document.createElement("span");
          artistNode.className = "mt-0.5 block truncate text-sm font-medium text-zinc-500 dark:text-zinc-400";
          artistNode.textContent = "歌曲 · " + (track.artist || "Echo 用户");
          meta.append(titleNode, artistNode);
          var plus = document.createElement("span");
          plus.className = "grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition group-hover:bg-zinc-200 group-hover:text-zinc-950 dark:group-hover:bg-zinc-700 dark:group-hover:text-white";
          plus.innerHTML = '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>';
          button.append(meta, plus);
          topSearchSuggestions.appendChild(button);
        });

        if (!hasContent && query) {
          var empty = document.createElement("a");
          empty.className = "flex items-center gap-4 rounded-lg px-3 py-3 transition hover:bg-zinc-100 dark:hover:bg-zinc-800";
          empty.href = searchUrlFor(query);
          appendSuggestionIcon(empty);
          var emptyText = document.createElement("span");
          emptyText.className = "min-w-0";
          var emptyTitle = document.createElement("span");
          emptyTitle.className = "block truncate font-bold";
          emptyTitle.textContent = "搜索 " + query;
          var emptyMeta = document.createElement("span");
          emptyMeta.className = "block truncate text-sm text-zinc-500 dark:text-zinc-400";
          emptyMeta.textContent = "查看完整搜索结果";
          emptyText.append(emptyTitle, emptyMeta);
          empty.appendChild(emptyText);
          topSearchSuggestions.appendChild(empty);
        }
        showTopSearchSuggestions();
      }
      function requestTopSearchSuggestions() {
        if (!topSearchInput || !topSearchSuggestions) return;
        syncTopSearchClear();
        var query = topSearchInput.value.trim();
        if (!query) {
          hideTopSearchSuggestions();
          topSearchSuggestions.replaceChildren();
          return;
        }
        window.clearTimeout(searchSuggestTimer);
        searchSuggestTimer = window.setTimeout(function () {
          var requestId = ++searchSuggestRequestId;
          if (searchSuggestAbort) searchSuggestAbort.abort();
          searchSuggestAbort = new AbortController();
          var url = (echoConfig.searchSuggestUrl || "/search/suggest/") + "?q=" + encodeURIComponent(query);
          fetch(url, {
            credentials: "same-origin",
            headers: { "X-Requested-With": "XMLHttpRequest" },
            signal: searchSuggestAbort.signal,
          })
            .then(function (response) {
              if (!response.ok) throw new Error("suggest failed");
              return response.json();
            })
            .then(function (payload) {
              if (requestId !== searchSuggestRequestId) return;
              renderTopSearchSuggestions(payload || { query: query, suggestions: [], tracks: [] });
            })
            .catch(function (error) {
              if (error && error.name === "AbortError") return;
              renderTopSearchSuggestions({ query: query, suggestions: [], tracks: [] });
            });
        }, 140);
      }

      document.addEventListener("click", function (event) {
        const homeTrigger = event.target.closest("[data-home-nav]");
        if (homeTrigger) {
          window.EchoHome(event);
        }
      }, true);
      window.EchoHome = function (event) {
        if (event) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return resetMainContentToHome();
      };

      applyTheme(readPersistedValue("echo_theme", root.dataset.echoTheme || "dark"));
      applySidebar(localStorage.getItem("echo_sidebar_collapsed") === "true");
      applyContext(true);
      restorePersistedPlayQueue();
      try {
        const savedStack = JSON.parse(localStorage.getItem("echo_context_view_stack") || "[]");
        contextViewStack = Array.isArray(savedStack) && savedStack.length ? savedStack : ["now"];
      } catch (error) {
        contextViewStack = ["now"];
      }
      renderContextView();
      queueTopSearchLayout();
      queuePlaybackLayout();
      var urlParams = new URLSearchParams(window.location.search);
      var urlTrackId = urlParams.get("track") || "";
      var storedTrackId = readPersistedValue("echo_current_track_id", "") || "";
      var storedTrackTime = Number(readPersistedValue("echo_player_time", "0") || "0");
      if (!Number.isFinite(storedTrackTime) || storedTrackTime < 0) storedTrackTime = 0;
      pendingResumeTime = storedTrackTime > 0 ? storedTrackTime : null;
      pendingResumeTrackId = pendingResumeTime !== null ? (urlTrackId || storedTrackId || "") : "";
      if (playlistTrackList) {
        var initTrack = null;
        var queueSeedTrack = null;
        if (urlTrackId) {
          initTrack = playlistTrackList.querySelector('.playlist-track[data-echo-track][data-id="' + CSS.escape(String(urlTrackId)) + '"]');
        }
        if (!initTrack && storedTrackId) {
          initTrack = playlistTrackList.querySelector('.playlist-track[data-echo-track][data-id="' + CSS.escape(String(storedTrackId)) + '"]');
        }
        if (!initTrack && storedTrackId) {
          queueSeedTrack = ensurePlayQueue(storedTrackId).find(function (item) {
            return String(item.id) === String(storedTrackId);
          }) || null;
        }
        if (!initTrack) {
          initTrack = playlistTrackList.querySelector(".playlist-track[data-echo-track]");
        }
        if (initTrack) {
          var queueContext = resolveQueueContext(initTrack);
          setPlayQueue(queueContext.queue, initTrack.dataset.id, queueContext.name);
          selectTrack(trackFromElement(initTrack));
        } else if (queueSeedTrack) {
          selectTrack(queueSeedTrack);
        } else if (urlTrackId) {
          setCurrentTrack(urlTrackId);
        }
      } else if (urlTrackId || storedTrackId) {
        var seedTrackId = urlTrackId || storedTrackId;
        var persistedTrack = ensurePlayQueue(seedTrackId).find(function (item) {
          return String(item.id) === String(seedTrackId);
        }) || null;
        if (persistedTrack) {
          selectTrack(persistedTrack);
        } else {
          setCurrentTrack(seedTrackId);
        }
      }
      ensurePlayQueue(currentTrackId || storedTrackId || urlTrackId || "");
      rebuildShufflePool();
      updatePlaybackModeUI();
      audio.volume = Number(readPersistedValue("echo_player_volume", "0.72") || "0.72");
      if (volume) volume.value = audio.volume;
      document.body.addEventListener("input", function (event) {
        const form = event.target.closest("#main-content form");
        if (form) form.dataset.echoDirty = "true";
      });
      document.body.addEventListener("change", function (event) {
        const form = event.target.closest("#main-content form");
        if (form) form.dataset.echoDirty = "true";
      });
      document.body.addEventListener("submit", function (event) {
        const form = event.target.closest("#main-content form");
        if (form) form.dataset.echoDirty = "false";
      });
      if (topSearchInput) {
        syncTopSearchClear();
        topSearchInput.addEventListener("focus", function () {
          if (topSearchInput.value.trim()) requestTopSearchSuggestions();
        });
        topSearchInput.addEventListener("input", requestTopSearchSuggestions);
        topSearchInput.addEventListener("keydown", function (event) {
          if (event.key === "Escape") {
            hideTopSearchSuggestions();
            topSearchInput.blur();
          }
        });
      }
      if (topSearchClear) {
        topSearchClear.addEventListener("click", function () {
          if (!topSearchInput) return;
          topSearchInput.value = "";
          topSearchInput.focus();
          syncTopSearchClear();
          hideTopSearchSuggestions();
        });
      }
      if (topSearchSuggestions) {
        topSearchSuggestions.addEventListener("click", function (event) {
          if (event.target.closest("[data-echo-track]")) {
            window.setTimeout(hideTopSearchSuggestions, 0);
          }
        });
      }
      themeToggle.addEventListener("click", function () { applyTheme(root.classList.contains("dark") ? "light" : "dark"); });
      tooltipTriggers.forEach(function (trigger) {
        trigger.addEventListener("pointerenter", function () { updateTooltipDirection(trigger); });
        trigger.addEventListener("focusin", function () { updateTooltipDirection(trigger); });
      });
      sidebarToggles.forEach(function (button) {
        button.addEventListener("click", function () { applySidebar(localStorage.getItem("echo_sidebar_collapsed") !== "true"); });
      });
      if (libraryTrigger) {
        libraryTrigger.addEventListener("click", function () {
          if (leftSidebar.classList.contains("is-collapsed")) applySidebar(false);
        });
      }
      if (libraryCreateButton) {
        libraryCreateButton.addEventListener("click", function (event) {
          event.stopPropagation();
          setCreateMenu(!libraryCreate.classList.contains("is-open"));
        });
      }
      window.addEventListener("resize", function () {
        updateShellLayout();
        if (libraryCreate && libraryCreate.classList.contains("is-open")) positionCreateMenu();
        queueTopSearchLayout();
        queuePlaybackLayout();
      });
      document.addEventListener("click", function (event) {
        if (libraryCreate && !libraryCreate.contains(event.target)) setCreateMenu(false);
        if (topSearchSuggestions && topSearchForm && !topSearchForm.contains(event.target) && !topSearchSuggestions.contains(event.target)) {
          hideTopSearchSuggestions();
        }
        if (trackContextMenu && !trackContextMenu.contains(event.target)) {
          hideTrackContextMenu();
        }
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          setCreateMenu(false);
          hideTrackContextMenu();
          hideTopSearchSuggestions();
        }
      });
      closeContext.addEventListener("click", function () {
        if (isContextCollapsed()) {
          setContextCollapsed(false);
          applyContext(true);
          closeContext.blur();
          return;
        }
        if (popContextView()) {
          closeContext.blur();
          return;
        }
        setContextCollapsed(true);
        applyContext(true);
        closeContext.blur();
      });
      if (openPlaylist) {
        openPlaylist.addEventListener("click", function () {
          pushContextView("playlist");
          applyContext(true);
        });
      }
      if (volume) {
        volume.addEventListener("input", function () {
          audio.volume = Number(volume.value);
          writePersistedValue("echo_player_volume", volume.value);
        });
      }
      var resolvePlaybackTrackId = function () {
        var urlParams = new URLSearchParams(window.location.search);
        return currentTrackId || readPersistedValue("echo_current_track_id", "") || urlParams.get("track") || "";
      };
      var openPlaybackResource = function (event, resourceName) {
        var trackId = resolvePlaybackTrackId();
        if (!trackId) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        setCurrentTrack(trackId);
        loadMainResource(resourceName, trackId);
      };
      if (lyricsNav) {
        lyricsNav.addEventListener("click", function (event) {
          openPlaybackResource(event, "lyrics");
        }, true);
      }
      if (commentsNav) {
        commentsNav.addEventListener("click", function (event) {
          openPlaybackResource(event, "comments");
        }, true);
      }
      toggle.addEventListener("click", function () {
        if (!audio.src) return;
        audio.paused ? audio.play() : audio.pause();
      });
      if (shuffleToggle) {
        shuffleToggle.addEventListener("click", function () {
          shuffleEnabled = !shuffleEnabled;
          playbackHistory = [];
          rebuildShufflePool();
          persistPlaybackModes();
          updatePlaybackModeUI();
          showToast(shuffleEnabled ? "已开启随机播放。" : "已切回顺序播放。", "info");
        });
      }
      if (repeatToggle) {
        repeatToggle.addEventListener("click", function () {
          repeatMode = repeatMode === "all" ? "one" : repeatMode === "one" ? "off" : "all";
          persistPlaybackModes();
          updatePlaybackModeUI();
          showToast("播放模式已切换为" + repeatModeLabel(repeatMode) + "。", "info");
        });
      }
      if (prevButton) {
        prevButton.addEventListener("click", function () {
          playPlaylistOffset(-1, { source: "prev" });
        });
      }
      if (nextButton) {
        nextButton.addEventListener("click", function () {
          playPlaylistOffset(1, { source: "next" });
        });
      }
      resetProgress();
      progress.addEventListener("pointerdown", function () {
        isSeeking = true;
        pendingSeekTime = progressTime();
      });
      progress.addEventListener("input", function () {
        previewProgressSeek();
      });
      progress.addEventListener("change", function () {
        commitProgressSeek();
        isSeeking = false;
        pendingSeekTime = null;
      });
      progress.addEventListener("pointerup", function () {
        commitProgressSeek();
        isSeeking = false;
        pendingSeekTime = null;
      });
      progress.addEventListener("pointercancel", function () {
        isSeeking = false;
        pendingSeekTime = null;
        if (hasUsableDuration()) {
          progress.value = String(audio.currentTime);
          current.textContent = formatTime(audio.currentTime);
        }
      });
      audio.addEventListener("seeked", function () {
        if (!hasUsableDuration()) return;
        isSeeking = false;
        pendingSeekTime = null;
        progress.value = String(audio.currentTime);
        current.textContent = formatTime(audio.currentTime);
        persistPlaybackState(true);
        syncLyricsActiveLine();
      });
      audio.addEventListener("loadedmetadata", function () {
        if (pendingResumeTime !== null && currentTrackId) {
          var resumeTime = clampNumber(pendingResumeTime, 0, hasUsableDuration() ? audio.duration : pendingResumeTime);
          audio.currentTime = resumeTime;
          progress.value = String(resumeTime);
          current.textContent = formatTime(resumeTime);
          pendingResumeTime = null;
          pendingResumeTrackId = "";
          lastPersistedPlaybackSecond = Math.max(0, Math.floor(resumeTime));
        }
        syncProgressMetadata();
      });
      audio.addEventListener("durationchange", function () {
        syncProgressMetadata();
      });
      audio.addEventListener("emptied", function () {
        resetProgress();
        setPlayerStatus("");
      });
      audio.addEventListener("timeupdate", function () {
        if (hasUsableDuration() && !isSeeking) {
          progress.value = String(audio.currentTime);
          current.textContent = formatTime(audio.currentTime);
        }
        persistPlaybackState(false);
        if (isSeeking) {
          syncLyricsActiveLine(pendingSeekTime !== null ? pendingSeekTime : progressTime(), false);
        } else {
          syncLyricsActiveLine();
        }
      });
      audio.addEventListener("play", function () {
        setPlaying(true);
        reportTrackPlay();
        persistPlaybackState(true);
      });
      audio.addEventListener("pause", function () {
        setPlaying(false);
        persistPlaybackState(true);
      });
      audio.addEventListener("ended", function () {
        persistPlaybackState(true);
        if (repeatMode === "one") {
          restartCurrentTrack();
          return;
        }
        playPlaylistOffset(1, { source: "ended" });
      });
      audio.addEventListener("error", function () {
        setPlaying(false);
        setPlayerStatus("音频加载失败，请切换作品或稍后重试。");
        showToast("当前音频加载失败，请稍后重试。", "error");
      });
      document.body.addEventListener("click", function (event) {
        const lyricLine = event.target.closest(".lyrics-line[data-start-ms]");
        if (lyricLine && hasUsableDuration()) {
          const startMs = parseInt(lyricLine.dataset.startMs, 10);
          if (Number.isFinite(startMs)) {
            audio.currentTime = startMs / 1000;
            syncLyricsActiveLine(startMs / 1000, true);
            return;
          }
        }

        const trigger = event.target.closest("[data-echo-track]");
        if (!trigger) return;
        var queueContext = resolveQueueContext(trigger);
        playTrack(trackFromElement(trigger), {
          source: "manual",
          queue: queueContext.queue,
          queueName: queueContext.name,
          queueIndex: queueContext.index,
        });
        if (pointerActivatedTrack && trigger.closest("#playlist-track-list")) {
          trigger.blur();
        }
        pointerActivatedTrack = false;
      });
      document.body.addEventListener("contextmenu", function (event) {
        const trigger = event.target.closest("[data-echo-track]");
        if (!trigger) return;
        showTrackContextMenu(event, trigger);
      });
      document.body.addEventListener("pointerdown", function (event) {
        pointerActivatedTrack = Boolean(event.target.closest("[data-echo-track]"));
      }, true);
      window.addEventListener("scroll", hideTrackContextMenu, true);
      window.addEventListener("resize", hideTrackContextMenu);
      document.addEventListener("wheel", function (event) {
        if (event.target.closest("#main-content [data-echo-resource='lyrics']") && Date.now() - lastAutoScrollTime > 600) {
          lastUserScrollTime = Date.now();
        }
      }, { passive: true });
      document.addEventListener("touchmove", function (event) {
        if (event.target.closest("#main-content [data-echo-resource='lyrics']") && Date.now() - lastAutoScrollTime > 600) {
          lastUserScrollTime = Date.now();
        }
      }, { passive: true });
      document.addEventListener("htmx:beforeRequest", function (event) {
        cancelActiveResourceLoad();
      });
      document.addEventListener("htmx:sendError", function () {
        showToast("网络连接失败，请检查后重试。", "error");
      });
      document.addEventListener("htmx:responseError", function (event) {
        const status = event.detail && event.detail.xhr ? event.detail.xhr.status : 0;
        if (status === 404) {
          showToast("请求的内容不存在。", "error");
          return;
        }
        if (status >= 500) {
          showToast("服务器暂时不可用，请稍后再试。", "error");
          return;
        }
        showToast("请求没有成功完成，请稍后再试。", "error");
      });
      document.addEventListener("htmx:afterSettle", function () {
        syncMainResourceState();
        syncLyricsPanelTheme();
      });
      syncMainResourceState();
      syncLyricsPanelTheme();
    })();
