    (function () {
      const root = document.documentElement;
      function readEchoConfig() {
        if (window.EchoConfig) return window.EchoConfig;
        var configNode = document.getElementById("echo-config");
        if (!configNode) return {};
        try {
          window.EchoConfig = JSON.parse(configNode.textContent || "{}");
          return window.EchoConfig;
        } catch (_error) {
          return {};
        }
      }
      const echoConfig = readEchoConfig();
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
      const accountMenu = document.querySelector(".account-menu");
      const accountMenuTrigger = document.querySelector("[data-account-menu-trigger]");
      const accountMenuPanel = document.querySelector("[data-account-menu]");
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
      const playerLikeButton = document.getElementById("player-like-button");
      const cover = document.getElementById("player-cover");
      const sideCover = document.getElementById("side-cover");
      const sideTitle = document.getElementById("side-title");
      const sideArtist = document.getElementById("side-artist");
      const playlistTrackList = document.getElementById("playlist-track-list");
      const playlistTrackCount = document.getElementById("playlist-track-count");
      const playlistQueueSource = document.getElementById("playlist-queue-source");
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
      let trackLikeStatusRequestId = 0;
      let trackContextSubmenuCloseTimer = 0;

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
      function copyTextToClipboard(text, successMessage) {
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () {
            showToast(successMessage || "链接已复制。", "info");
          }).catch(function () {
            showToast("复制失败，请手动复制。", "error");
          });
          return;
        }
        var input = document.createElement("textarea");
        input.value = text;
        input.setAttribute("readonly", "readonly");
        input.style.position = "fixed";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.select();
        try {
          document.execCommand("copy");
          showToast(successMessage || "链接已复制。", "info");
        } catch (_error) {
          showToast("复制失败，请手动复制。", "error");
        }
        input.remove();
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
      function queueDisplayName(name) {
        if (!name) return "默认播放队列";
        if (name === "sidebar-playlist") return "默认播放队列";
        if (name === "recent-tracks") return "最近播放";
        if (name === "recommended-tracks") return "首页推荐";
        if (name === "latest-tracks") return "最新音乐";
        if (name === "search-tracks") return "搜索结果";
        if (name === "track-detail") return "作品详情";
        if (name === "profile-tracks") return "个人主页";
        if (name.indexOf("playlist-") === 0) return "歌单";
        if (name === "hero-track") return "首页主打";
        return name.replace(/[-_]+/g, " ");
      }
      function renderPlayQueue() {
        if (!playlistTrackList) return;
        playlistTrackList.innerHTML = "";
        if (playlistTrackCount) {
          var positionText = playQueueIndex >= 0 && playQueue.length
            ? "第 " + (playQueueIndex + 1) + " / " + playQueue.length + " 首"
            : playQueue.length + " 首";
          playlistTrackCount.textContent = positionText;
        }
        if (playlistQueueSource) {
          playlistQueueSource.textContent = queueDisplayName(playQueueName);
        }
        if (!playQueue.length) {
          var empty = document.createElement("div");
          empty.className = "rounded-lg border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400";
          empty.textContent = "暂时没有可播放的作品";
          playlistTrackList.appendChild(empty);
          return;
        }
        playQueue.forEach(function (track, index) {
          var button = document.createElement("div");
          button.className = "playlist-track group grid w-full grid-cols-[26px_44px_minmax(0,1fr)_28px] items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-900";
          button.setAttribute("role", "button");
          button.setAttribute("tabindex", "0");
          button.dataset.echoTrack = "";
          button.dataset.src = track.src || "";
          button.dataset.id = track.id || "";
          button.dataset.title = track.title || "";
          button.dataset.artist = track.artist || "";
          button.dataset.cover = track.cover || "summer";
          button.dataset.coverUrl = track.coverUrl || "";
          button.dataset.queueIndex = String(index);
          button.setAttribute("aria-label", "播放 " + (track.title || "未命名音频"));
          button.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              button.click();
            }
          });

          var indexWrap = document.createElement("span");
          indexWrap.className = "grid h-6 w-6 place-items-center text-xs font-bold text-zinc-500";
          var indexText = document.createElement("span");
          indexText.className = "playlist-track-index";
          indexText.textContent = String(index + 1);
          var playingMark = document.createElement("span");
          playingMark.className = "playlist-playing-mark h-2 w-2 rounded-full bg-brand";
          playingMark.setAttribute("aria-hidden", "true");
          indexWrap.appendChild(indexText);
          indexWrap.appendChild(playingMark);

          var coverNode = document.createElement("span");
          coverNode.className = "cover-media h-11 w-11 rounded-lg";
          setCover(coverNode, track.cover || "summer", track.coverUrl || "");

          var meta = document.createElement("span");
          meta.className = "min-w-0";
          var trackTitle = document.createElement("span");
          trackTitle.className = "block truncate text-sm font-bold";
          trackTitle.textContent = track.title || "未命名音频";
          var trackArtist = document.createElement("span");
          trackArtist.className = "mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400";
          trackArtist.textContent = track.artist || "Echo 用户";
          meta.appendChild(trackTitle);
          meta.appendChild(trackArtist);

          var details = document.createElement("a");
          details.className = "grid h-7 w-7 place-items-center rounded-full text-zinc-500 opacity-0 transition hover:bg-zinc-200 hover:text-zinc-900 group-hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-white";
          details.href = "/tracks/" + encodeURIComponent(track.id || "") + "/";
          details.setAttribute("aria-label", "查看详情");
          details.innerHTML = '<span aria-hidden="true">...</span>';
          details.addEventListener("click", function (event) {
            event.stopPropagation();
          });
          details.addEventListener("pointerdown", function (event) {
            event.stopPropagation();
          });

          button.appendChild(indexWrap);
          button.appendChild(coverNode);
          button.appendChild(meta);
          button.appendChild(details);
          playlistTrackList.appendChild(button);
        });
        if (currentTrackId) setCurrentTrack(currentTrackId);
      }
      function persistPlayQueue() {
        writePersistedValue("echo_play_queue_name", playQueueName || "");
        writePersistedValue("echo_play_queue_index", playQueueIndex >= 0 ? String(playQueueIndex) : "-1");
        try {
          localStorage.setItem("echo_play_queue", JSON.stringify(playQueue));
        } catch (_error) {}
        renderPlayQueue();
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
        const nextTime = progressTime();
        current.textContent = formatTime(nextTime);
        syncLyricsActiveLine(nextTime, false);
      }
      function commitProgressSeek() {
        if (!hasUsableDuration()) return;
        const nextTime = progressTime();
        audio.currentTime = nextTime;
        progress.value = String(nextTime);
        current.textContent = formatTime(nextTime);
        syncLyricsActiveLine(nextTime, false);
      }
      function beginProgressSeek() {
        if (!hasUsableDuration()) return;
        isSeeking = true;
        previewProgressSeek();
      }
      function finishProgressSeek() {
        if (!isSeeking) return;
        commitProgressSeek();
        isSeeking = false;
      }
      function cancelProgressSeek() {
        isSeeking = false;
        if (hasUsableDuration()) {
          progress.value = String(audio.currentTime);
          current.textContent = formatTime(audio.currentTime);
        }
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
      function trackLikeUrl(trackId) {
        const template = echoConfig.trackLikeUrlTemplate || "/tracks/__track_id__/like/";
        return template.replace("__track_id__", encodeURIComponent(trackId));
      }
      function trackLikeStatusUrl(trackId) {
        const template = echoConfig.trackLikeStatusUrlTemplate || "/tracks/__track_id__/like/status/";
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
      function toggleReplyForm(button) {
        var targetId = button ? button.dataset.target : "";
        var form = targetId ? document.getElementById(targetId) : null;
        if (!form) return;
        form.classList.toggle("hidden");
        var textarea = form.querySelector("textarea[name='body']");
        if (!form.classList.contains("hidden") && textarea) textarea.focus();
      }
      function toggleCommentLike(button) {
        if (!button || button.dataset.loading === "true") return;
        var url = button.dataset.url || "";
        if (!url) return;
        button.dataset.loading = "true";
        fetch(url, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "X-CSRFToken": getCookie("csrftoken") || echoConfig.csrfToken || "",
            "X-Requested-With": "XMLHttpRequest",
          },
        })
          .then(function (response) {
            if (!response.ok) throw new Error("comment like failed");
            return response.json();
          })
          .then(function (payload) {
            if (!payload || !payload.ok) return;
            var count = button.querySelector("[data-comment-like-count]");
            if (count) count.textContent = payload.like_count;
            button.classList.toggle("text-brand", Boolean(payload.liked));
          })
          .catch(function () {
            showToast("点赞没有成功，请稍后再试。", "error");
          })
          .finally(function () {
            delete button.dataset.loading;
          });
      }
      function updateTrackLikeButtons(trackId, liked, likeCount) {
        document.querySelectorAll('[data-track-like][data-track-id="' + String(trackId) + '"]').forEach(function (button) {
          button.classList.toggle("text-brand", Boolean(liked));
          button.classList.toggle("text-zinc-500", !liked);
          button.setAttribute("aria-pressed", liked ? "true" : "false");
          var labelPrefix = liked ? "取消喜欢 " : "喜欢 ";
          var trackTitle = button.dataset.trackTitle || (button.getAttribute("aria-label") || "").replace(/^取消喜欢 |^喜欢 /, "");
          button.setAttribute("aria-label", labelPrefix + trackTitle);
          var icon = button.querySelector("svg");
          if (icon) icon.setAttribute("fill", liked ? "currentColor" : "none");
        });
        document.querySelectorAll('[data-track-like-count="' + String(trackId) + '"]').forEach(function (count) {
          count.textContent = likeCount;
        });
      }
      function updateLikedPlaylistCount(label) {
        if (label === undefined || label === null) return;
        document.querySelectorAll("[data-liked-playlist-count]").forEach(function (count) {
          count.textContent = String(label);
        });
      }
      function resetPlayerLikeButton() {
        if (!playerLikeButton) return;
        playerLikeButton.dataset.trackId = "";
        playerLikeButton.dataset.trackTitle = "";
        playerLikeButton.dataset.url = "";
        playerLikeButton.disabled = true;
        playerLikeButton.classList.remove("text-brand");
        playerLikeButton.classList.add("text-zinc-500");
        playerLikeButton.setAttribute("aria-pressed", "false");
        playerLikeButton.setAttribute("aria-label", "喜欢当前歌曲");
        var icon = playerLikeButton.querySelector("svg");
        if (icon) icon.setAttribute("fill", "none");
      }
      function refreshPlayerLikeState(trackId) {
        if (!playerLikeButton) return;
        if (!trackId) {
          resetPlayerLikeButton();
          return;
        }
        playerLikeButton.dataset.trackId = String(trackId);
        playerLikeButton.dataset.trackTitle = title ? title.textContent : "当前歌曲";
        playerLikeButton.dataset.url = trackLikeUrl(trackId);
        playerLikeButton.disabled = false;

        var requestId = ++trackLikeStatusRequestId;
        fetch(trackLikeStatusUrl(trackId), {
          credentials: "same-origin",
          headers: { "X-Requested-With": "XMLHttpRequest" },
        })
          .then(function (response) {
            if (!response.ok) throw new Error("track like status failed");
            return response.json();
          })
          .then(function (payload) {
            if (requestId !== trackLikeStatusRequestId || !payload || !payload.ok) return;
            updateTrackLikeButtons(payload.track_id, Boolean(payload.liked), payload.like_count);
          })
          .catch(function () {
            if (requestId === trackLikeStatusRequestId) resetPlayerLikeButton();
          });
      }
      function toggleTrackLike(button) {
        if (!button || button.dataset.loading === "true") return;
        if (!echoConfig.isAuthenticated) {
          window.location.href = (echoConfig.loginUrl || "/login/") + "?next=" + encodeURIComponent(window.location.pathname + window.location.search);
          return;
        }
        var url = button.dataset.url || "";
        if (!url) return;
        button.dataset.loading = "true";
        fetch(url, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "X-CSRFToken": getCookie("csrftoken") || echoConfig.csrfToken || "",
            "X-Requested-With": "XMLHttpRequest",
          },
        })
          .then(function (response) {
            if (!response.ok) throw new Error("track like failed");
            return response.json();
          })
          .then(function (payload) {
            if (!payload || !payload.ok) return;
            updateTrackLikeButtons(payload.track_id, Boolean(payload.liked), payload.like_count);
            updateLikedPlaylistCount(payload.liked_track_count_label);
          })
          .catch(function () {
            showToast("喜欢状态没有更新成功，请稍后再试。", "error");
          })
          .finally(function () {
            delete button.dataset.loading;
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
          var activeIndex = playQueueIndex;
          if (activeIndex < 0 && playQueue.length) {
            activeIndex = queueIndexForTrack(playQueue, trackId);
          }
          Array.from(playlistTrackList.querySelectorAll(".playlist-track")).forEach(function (item, index) {
            var itemQueueIndex = item.dataset.queueIndex !== undefined ? parseInt(item.dataset.queueIndex, 10) : index;
            var active = itemQueueIndex === activeIndex && item.dataset.id === String(trackId);
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
      function queueIndexForElement(container, trigger) {
        if (!container || !trigger) return -1;
        var item = trigger.closest("[data-echo-track]");
        if (!item) return -1;
        return Array.from(container.querySelectorAll("[data-echo-track]")).indexOf(item);
      }
      function resolveQueueContext(trigger) {
        var container = trigger ? trigger.closest("[data-play-queue]") : null;
        var queue = container ? queueTracksFromContainer(container) : [];
        var track = trackFromElement(trigger);
        var index = queueIndexForElement(container, trigger);
        if ((!queue.length || queueIndexForTrack(queue, track && track.id) < 0) && playlistTrackList) {
          container = playlistTrackList;
          queue = queueTracksFromContainer(playlistTrackList);
          index = queueIndexForElement(container, trigger);
        }
        return {
          name: container ? (container.dataset.playQueueLabel || container.dataset.playQueue || "") : "",
          queue: queue,
          index: index >= 0 ? index : queueIndexForTrack(queue, track && track.id),
        };
      }
      function fallbackQueueTracks() {
        return queueTracksFromContainer(playlistTrackList);
      }
      function ensurePlayQueue(trackId) {
        if (playQueue.length) {
          if (
            playQueueIndex >= 0 &&
            playQueueIndex < playQueue.length &&
            (!trackId || String(playQueue[playQueueIndex].id) === String(trackId))
          ) {
            return playQueue;
          }
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
        return playQueue;
      }
      function setPlayQueue(queue, currentId, queueName, currentIndex) {
        playQueue = Array.isArray(queue) ? queue.map(normalizeTrack).filter(Boolean) : [];
        playQueueName = queueName || "";
        playQueueIndex = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < playQueue.length
          ? currentIndex
          : queueIndexForTrack(playQueue, currentId);
        persistPlayQueue();
      }
      function playlistTracks() {
        if (!playlistTrackList) return [];
        return Array.from(playlistTrackList.querySelectorAll(".playlist-track[data-echo-track]"));
      }
      function playlistTrackAtQueueIndex(index, trackId) {
        if (!playlistTrackList || index < 0) return null;
        var item = playlistTrackList.querySelector('.playlist-track[data-queue-index="' + String(index) + '"]');
        if (!item) return null;
        return !trackId || String(item.dataset.id) === String(trackId) ? item : null;
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
          .map(function (_item, index) { return index; })
          .filter(function (index) { return index !== playQueueIndex; });
        for (let i = candidates.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          const temp = candidates[i];
          candidates[i] = candidates[j];
          candidates[j] = temp;
        }
        shufflePool = candidates;
      }
      function playTrackByQueueIndex(index, options) {
        const tracks = ensurePlayQueue();
        if (index < 0 || index >= tracks.length) return false;
        const playbackOptions = options || {};
        playbackOptions.queueIndex = index;
        playTrack(tracks[index], playbackOptions);
        return true;
      }
      function playTrackById(trackId, options) {
        const tracks = ensurePlayQueue(trackId);
        const targetIndex = queueIndexForTrack(tracks, trackId);
        if (targetIndex < 0) return false;
        const target = tracks[targetIndex];
        if (!target) return false;
        const playbackOptions = options || {};
        playbackOptions.queueIndex = targetIndex;
        playTrack(target, playbackOptions);
        return true;
      }
      function nextShuffleQueueIndex() {
        if (!shufflePool.length) {
          if (repeatMode === "off") return -1;
          rebuildShufflePool();
        }
        var nextIndex = shufflePool.shift();
        return Number.isInteger(nextIndex) ? nextIndex : -1;
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
            const previousQueueIndex = playbackHistory.pop();
            return playTrackByQueueIndex(previousQueueIndex, { rememberHistory: false, resetShufflePool: false, source: "history" });
          }
          if (offset < 0) {
            return playTrackByQueueIndex(0, { rememberHistory: false, resetShufflePool: false, source: "history" });
          }
          const nextQueueIndex = nextShuffleQueueIndex();
          if (nextQueueIndex < 0) {
            if (repeatMode === "one") {
              restartCurrentTrack();
              return true;
            }
            setPlaying(false);
            showToast("随机播放已经到末尾了。", "info");
            return false;
          }
          return playTrackByQueueIndex(nextQueueIndex, { resetShufflePool: false, source: options && options.source ? options.source : "next" });
        }

        let currentIndex = playQueueIndex >= 0 && playQueueIndex < tracks.length
          ? playQueueIndex
          : queueIndexForTrack(tracks, currentTrackId);
        if (currentIndex < 0) currentIndex = offset > 0 ? -1 : 0;
        const nextIndex = currentIndex + offset;
        if (nextIndex < 0) {
          if (repeatMode === "all" || repeatMode === "one") {
            return playTrack(tracks[tracks.length - 1], { source: options && options.source ? options.source : "prev", queueIndex: tracks.length - 1 });
          }
          return playTrack(tracks[0], { rememberHistory: false, source: "prev", queueIndex: 0 });
        }
        if (nextIndex >= tracks.length) {
          if (repeatMode === "all" || repeatMode === "one") {
            return playTrack(tracks[0], { source: options && options.source ? options.source : "next", queueIndex: 0 });
          }
          setPlaying(false);
          audio.pause();
          audio.currentTime = hasUsableDuration() ? audio.duration : audio.currentTime;
          if (options && options.source === "ended") {
            showToast("播放列表已经结束。", "info");
          }
          return false;
        }
        return playTrack(tracks[nextIndex], { source: options && options.source ? options.source : "next", queueIndex: nextIndex });
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
      function applyMainContentSwap(html, url) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const nextMain = extractMainContent(doc);
        const currentMain = document.getElementById("main-content");
        if (!nextMain || !currentMain) return false;
        currentMain.outerHTML = nextMain.outerHTML;
        clearMainContentDirtyState();
        syncMainResourceState();
        syncLyricsPanelTheme();
        initPlaylistTabs(document);
        initInfiniteLists(document);
        if (url) history.pushState({}, "", url);
        return true;
      }
      function loadMainContentUrl(url) {
        if (!url) return false;
        if (mainContentHasDirtyForm()) {
          const ok = window.confirm("当前页面有未保存的编辑内容，确定要离开吗？");
          if (!ok) return false;
        }
        setCreateMenu(false);
        setAccountMenu(false);
        hideTopSearchSuggestions();
        cancelActiveResourceLoad();
        fetch(url, { cache: "no-store", headers: { "HX-Request": "true" } })
          .then(function (response) {
            if (!response.ok) throw new Error("main navigation failed");
            return response.text();
          })
          .then(function (html) {
            if (!applyMainContentSwap(html, url)) window.location.href = url;
          })
          .catch(function () {
            showToast("内容加载失败，已切换为完整页面。", "error");
            window.location.href = url;
          });
        return false;
      }
      function urlFromMainNavForm(form) {
        const action = form.getAttribute("action") || window.location.pathname;
        const method = (form.getAttribute("method") || "get").toLowerCase();
        if (method !== "get") return "";
        const url = new URL(action, window.location.origin);
        const params = new URLSearchParams(new FormData(form));
        url.search = params.toString();
        return url.pathname + url.search + url.hash;
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
            applyMainContentSwap(html, echoConfig.homeUrl);
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
      function setAccountMenu(open) {
        if (!accountMenu || !accountMenuTrigger || !accountMenuPanel) return;
        accountMenu.classList.toggle("is-open", open);
        accountMenuTrigger.setAttribute("aria-expanded", open ? "true" : "false");
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
        refreshPlayerLikeState(track.id || "");
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
        var hasIncomingQueue = Array.isArray(playbackOptions.queue) && playbackOptions.queue.length;
        var previousQueueIndex = playQueueIndex;
        if (hasIncomingQueue) {
          setPlayQueue(playbackOptions.queue, normalizedTrack.id, playbackOptions.queueName || "", playbackOptions.queueIndex);
        } else if (!playQueue.length) {
          ensurePlayQueue(normalizedTrack.id);
        } else {
          playQueueIndex = Number.isInteger(playbackOptions.queueIndex) && playbackOptions.queueIndex >= 0 && playbackOptions.queueIndex < playQueue.length
            ? playbackOptions.queueIndex
            : queueIndexForTrack(playQueue, normalizedTrack.id);
          if (playQueueIndex >= 0) persistPlayQueue();
        }
        if (
          playbackOptions.rememberHistory !== false &&
          !hasIncomingQueue &&
          previousQueueIndex >= 0 &&
          playQueueIndex >= 0 &&
          previousQueueIndex !== playQueueIndex
        ) {
          playbackHistory.push(previousQueueIndex);
          if (playbackHistory.length > 50) playbackHistory = playbackHistory.slice(-50);
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
      function revealPlaylistContext() {
        pushContextView("playlist");
        applyContext(true);
      }
      function queueElementIndex(element) {
        if (!playlistTrackList || !element) return -1;
        var item = element.closest(".playlist-track[data-echo-track]");
        if (!item || !playlistTrackList.contains(item)) return -1;
        return Array.from(playlistTrackList.querySelectorAll(".playlist-track[data-echo-track]")).indexOf(item);
      }
      function insertTrackInPlayQueue(track, placement) {
        var normalizedTrack = normalizeTrack(track);
        if (!normalizedTrack) return false;
        if (!playQueue.length) ensurePlayQueue(currentTrackId || normalizedTrack.id);
        if (!playQueue.length) {
          playQueue = [normalizedTrack];
          playQueueIndex = currentTrackId && String(currentTrackId) === String(normalizedTrack.id) ? 0 : -1;
          playQueueName = playQueueName || "manual";
        } else if (placement === "next") {
          playQueue.splice(playQueueIndex >= 0 ? playQueueIndex + 1 : 0, 0, normalizedTrack);
        } else {
          playQueue.push(normalizedTrack);
        }
        persistPlayQueue();
        revealPlaylistContext();
        showToast(placement === "next" ? "\u5df2\u6dfb\u52a0\u5230\u4e0b\u4e00\u9996\u64ad\u653e\u3002" : "\u5df2\u52a0\u5165\u64ad\u653e\u961f\u5217\u3002", "info");
        return true;
      }
      function moveQueueElementNext(element) {
        var index = queueElementIndex(element);
        if (index < 0 || index >= playQueue.length) return false;
        var item = playQueue.splice(index, 1)[0];
        if (index < playQueueIndex) playQueueIndex -= 1;
        var insertAt = playQueueIndex >= 0 ? playQueueIndex + 1 : 0;
        playQueue.splice(insertAt, 0, item);
        if (index === playQueueIndex) playQueueIndex = insertAt;
        persistPlayQueue();
        revealPlaylistContext();
        showToast("\u5df2\u79fb\u5230\u4e0b\u4e00\u9996\u64ad\u653e\u3002", "info");
        return true;
      }
      function removeTrackFromPlayQueue(element) {
        var index = queueElementIndex(element);
        if (index < 0 || index >= playQueue.length) return false;
        playQueue.splice(index, 1);
        if (!playQueue.length) {
          playQueueIndex = -1;
        } else if (index < playQueueIndex) {
          playQueueIndex -= 1;
        } else if (index === playQueueIndex) {
          playQueueIndex = Math.min(playQueueIndex, playQueue.length - 1);
        }
        persistPlayQueue();
        revealPlaylistContext();
        showToast("\u5df2\u4ece\u64ad\u653e\u961f\u5217\u79fb\u9664\u3002", "info");
        return true;
      }
      var trackContextMenu = null;
      var trackContextElement = null;
      function contextMenuKind(element) {
        var holder = element ? element.closest("[data-context-menu-kind]") : null;
        if (holder && holder.dataset.contextMenuKind) return holder.dataset.contextMenuKind;
        if (element && element.closest("#playlist-track-list")) return "queue";
        if (element && element.closest("[data-echo-resource='track-detail']")) return "detail";
        return "track";
      }
      function ensureTrackContextMenu() {
        if (trackContextMenu) return trackContextMenu;
        trackContextMenu = document.createElement("div");
        trackContextMenu.id = "echo-track-context-menu";
        trackContextMenu.className = "track-context-menu";
        trackContextMenu.setAttribute("role", "menu");
        trackContextMenu.setAttribute("aria-hidden", "true");
        document.body.appendChild(trackContextMenu);
        return trackContextMenu;
      }
      function hideTrackContextMenu() {
        if (!trackContextMenu) return;
        window.clearTimeout(trackContextSubmenuCloseTimer);
        trackContextMenu.classList.remove("is-open");
        trackContextMenu.setAttribute("aria-hidden", "true");
        trackContextElement = null;
      }
      function setTrackSubmenuOpen(wrapper, open, persistMultiplier) {
        if (!wrapper) return;
        window.clearTimeout(trackContextSubmenuCloseTimer);
        if (open) {
          wrapper.classList.add("is-submenu-open");
          return;
        }
        trackContextSubmenuCloseTimer = window.setTimeout(function () {
          wrapper.classList.remove("is-submenu-open");
        }, persistMultiplier ? 900 : 450);
      }
      function addTrackContextMenuSeparator(menu) {
        var separator = document.createElement("div");
        separator.className = "track-context-menu-separator";
        separator.setAttribute("role", "separator");
        menu.appendChild(separator);
      }
      function addTrackContextMenuItem(menu, label, action, danger, options) {
        var itemOptions = options || {};
        var button = document.createElement("button");
        button.type = "button";
        button.className = "track-context-menu-item" + (danger ? " is-danger" : "");
        button.setAttribute("role", "menuitem");
        if (itemOptions.icon) {
          var icon = document.createElement("span");
          icon.className = "track-context-menu-icon";
          icon.innerHTML = itemOptions.icon;
          button.appendChild(icon);
        }
        var text = document.createElement("span");
        text.className = "track-context-menu-label";
        text.textContent = label;
        button.appendChild(text);
        if (itemOptions.suffix) {
          var suffix = document.createElement("span");
          suffix.className = "track-context-menu-suffix";
          suffix.textContent = itemOptions.suffix;
          button.appendChild(suffix);
        }
        button.addEventListener("click", function () {
          var element = trackContextElement;
          var track = trackFromElement(element);
          hideTrackContextMenu();
          action(track, element);
        });
        menu.appendChild(button);
      }
      function submitTrackToPlaylist(track, target) {
        if (!track || !track.id || !target || !target.url) return;
        var formData = new FormData();
        formData.set("track", track.id);
        fetch(target.url, {
          method: "POST",
          body: formData,
          credentials: "same-origin",
          headers: {
            "X-CSRFToken": echoConfig.csrfToken || "",
            "X-Requested-With": "XMLHttpRequest",
          },
        }).then(function (response) {
          if (!response.ok) throw new Error("playlist add failed");
          showToast("已收藏到 " + (target.title || "歌单") + "。", "info");
        }).catch(function () {
          showToast("收藏失败，请稍后再试。", "error");
        });
      }
      function addPlaylistFavoriteSubmenu(menu) {
        var wrapper = document.createElement("div");
        wrapper.className = "track-context-submenu-wrap";
        wrapper.setAttribute("role", "none");
        var button = document.createElement("button");
        button.type = "button";
        button.className = "track-context-menu-item";
        button.setAttribute("role", "menuitem");
        button.setAttribute("aria-haspopup", "menu");
        button.innerHTML = '<span class="track-context-menu-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg></span><span class="track-context-menu-label">收藏</span><span class="track-context-menu-suffix">›</span>';
        var submenu = document.createElement("div");
        submenu.className = "track-context-submenu";
        submenu.setAttribute("role", "menu");
        var createLink = document.createElement("a");
        createLink.className = "track-context-menu-item";
        createLink.href = echoConfig.isAuthenticated ? (echoConfig.playlistCreateUrl || "#") : (echoConfig.loginUrl || "/login/");
        createLink.innerHTML = '<span class="track-context-menu-icon">＋</span><span class="track-context-menu-label">创建新歌单</span>';
        submenu.appendChild(createLink);
        if (echoConfig.isAuthenticated && Array.isArray(echoConfig.playlistTargets) && echoConfig.playlistTargets.length) {
          addTrackContextMenuSeparator(submenu);
          echoConfig.playlistTargets.forEach(function (target) {
            var item = document.createElement("button");
            item.type = "button";
            item.className = "track-context-playlist-target";
            item.setAttribute("role", "menuitem");
            var cover = document.createElement("span");
            cover.className = "track-context-playlist-cover";
            cover.textContent = target.title === "我喜欢的音乐" ? "♥" : "♪";
            var text = document.createElement("span");
            text.className = "min-w-0";
            var titleNode = document.createElement("span");
            titleNode.className = "block truncate font-semibold";
            titleNode.textContent = target.title || "歌单";
            var metaNode = document.createElement("span");
            metaNode.className = "block truncate text-xs text-zinc-500";
            metaNode.textContent = target.meta || "";
            text.append(titleNode, metaNode);
            item.append(cover, text);
            item.addEventListener("click", function (event) {
              event.stopPropagation();
              var element = trackContextElement;
              var track = trackFromElement(element);
              hideTrackContextMenu();
              submitTrackToPlaylist(track, target);
            });
            submenu.appendChild(item);
          });
        }
        wrapper.append(button, submenu);
        wrapper.addEventListener("pointerenter", function () {
          setTrackSubmenuOpen(wrapper, true);
        });
        wrapper.addEventListener("pointerleave", function () {
          setTrackSubmenuOpen(wrapper, false, wrapper.dataset.stickySubmenu === "true");
        });
        button.addEventListener("click", function (event) {
          event.preventDefault();
          event.stopPropagation();
          wrapper.dataset.stickySubmenu = "true";
          setTrackSubmenuOpen(wrapper, true);
          window.setTimeout(function () {
            if (wrapper) wrapper.dataset.stickySubmenu = "false";
          }, 1800);
        });
        menu.appendChild(wrapper);
      }
      function showTrackContextMenu(event, trigger) {
        var track = trackFromElement(trigger);
        if (!track) return;
        event.preventDefault();
        event.stopPropagation();
        var menu = ensureTrackContextMenu();
        menu.innerHTML = "";
        trackContextElement = trigger;
        var kind = contextMenuKind(trigger);
        addTrackContextMenuItem(menu, "播放", function (item, element) {
          var queueContext = resolveQueueContext(element);
          playTrack(item, { source: "context-menu", queue: queueContext.queue, queueName: queueContext.name, queueIndex: queueContext.index });
        }, false, { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 5v14l11-7Z"/></svg>' });
        addTrackContextMenuItem(menu, "下一首播放", function (item, element) {
          if (kind === "queue") {
            moveQueueElementNext(element);
            return;
          }
          insertTrackInPlayQueue(item, "next");
        }, false, { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="m17 10-5-5-5 5"/></svg>' });
        addTrackContextMenuSeparator(menu);
        addPlaylistFavoriteSubmenu(menu);
        addTrackContextMenuItem(menu, "查看评论", function (item) {
          if (item && item.id) loadMainContentUrl((echoConfig.commentsUrl || "/comments/") + "?track=" + encodeURIComponent(item.id));
        }, false, { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/></svg>' });
        addTrackContextMenuItem(menu, "分享...", function (item) {
          if (item && item.id) copyTextToClipboard(window.location.origin + "/tracks/" + encodeURIComponent(item.id) + "/", "歌曲链接已复制。");
        }, false, { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8h16v-8"/><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/></svg>' });
        addTrackContextMenuItem(menu, "复制链接", function (item) {
          if (item && item.id) copyTextToClipboard(window.location.origin + "/tracks/" + encodeURIComponent(item.id) + "/", "歌曲链接已复制。");
        }, false, { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><rect x="2" y="2" width="13" height="13" rx="2"/></svg>' });
        if (kind === "playlist-detail") {
          var playlistRow = trigger ? trigger.closest("[data-playlist-row]") : null;
          if (playlistRow && playlistRow.querySelector("[data-playlist-remove-form]")) {
            addTrackContextMenuSeparator(menu);
            addTrackContextMenuItem(menu, "从歌单中删除", function (_item, element) {
              var row = element ? element.closest("[data-playlist-row]") : null;
              var form = row ? row.querySelector("[data-playlist-remove-form]") : null;
              if (form && window.confirm("确定从歌单中删除这首歌吗？")) form.submit();
            }, true, { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>' });
          }
        } else if (kind === "queue") {
          addTrackContextMenuSeparator(menu);
          addTrackContextMenuItem(menu, "从播放队列移除", function (_item, element) {
            removeTrackFromPlayQueue(element);
          }, true, { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' });
        } else {
          addTrackContextMenuItem(menu, "加入播放队列", function (item) {
            insertTrackInPlayQueue(item, "end");
          }, false, { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 12h.01"/></svg>' });
          if (kind !== "detail") {
            addTrackContextMenuItem(menu, "查看歌曲", function (item) {
              if (item && item.id) loadMainContentUrl("/tracks/" + encodeURIComponent(item.id) + "/");
            }, false, { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>' });
          }
        }
        var margin = 10;
        menu.classList.add("is-open");
        menu.setAttribute("aria-hidden", "false");
        var rect = menu.getBoundingClientRect();
        var submenuWidth = 260;
        var left = Math.min(event.clientX, window.innerWidth - rect.width - submenuWidth - margin);
        var top = Math.min(event.clientY, window.innerHeight - rect.height - margin);
        menu.style.left = Math.max(margin, left) + "px";
        menu.style.top = Math.max(margin, top) + "px";
      }
      var playlistDragRow = null;
      var playlistLongPressTimer = 0;
      function clearPlaylistDropMarks() {
        document.querySelectorAll(".playlist-song-row.is-drop-before, .playlist-song-row.is-drop-after").forEach(function (row) {
          row.classList.remove("is-drop-before", "is-drop-after");
        });
      }
      function playlistSortableRow(target) {
        var row = target ? target.closest("[data-playlist-sortable='true']") : null;
        if (!row) return null;
        if (target.closest("button, a, input, select, textarea, form")) return null;
        return row;
      }
      function enablePlaylistDrag(row) {
        row.setAttribute("draggable", "true");
        row.classList.add("is-drag-ready");
      }
      function submitPlaylistReorder(row, targetIndex) {
        if (!row || targetIndex < 0) return;
        var form = row.querySelector("[data-playlist-reorder-form]");
        var input = row.querySelector("[data-playlist-position-input]");
        if (!form || !input) return;
        input.value = String(targetIndex);
        form.submit();
      }
      function initPlaylistTabs(scope) {
        var rootNode = scope || document;
        rootNode.querySelectorAll("[data-playlist-tab]").forEach(function (tabButton) {
          if (tabButton.dataset.tabReady === "true") return;
          tabButton.dataset.tabReady = "true";
          tabButton.addEventListener("click", function () {
            var name = tabButton.dataset.playlistTab;
            var container = tabButton.closest("[data-context-menu-kind='playlist-detail']");
            if (!container || !name) return;
            container.querySelectorAll("[data-playlist-tab]").forEach(function (button) {
              var active = button === tabButton;
              button.classList.toggle("is-active", active);
              button.setAttribute("aria-selected", active ? "true" : "false");
            });
            container.querySelectorAll("[data-playlist-panel]").forEach(function (panel) {
              panel.classList.toggle("is-active", panel.dataset.playlistPanel === name);
            });
            initInfiniteLists(container);
          });
        });
      }
      function initInfiniteLists(scope) {
        var rootNode = scope || document;
        rootNode.querySelectorAll("[data-infinite-list]").forEach(function (list) {
          var step = parseInt(list.dataset.infiniteStep || "12", 10);
          if (!Number.isFinite(step) || step < 1) step = 12;
          var visible = parseInt(list.dataset.infiniteVisible || String(step), 10);
          if (!Number.isFinite(visible) || visible < step) visible = step;
          var items = Array.from(list.querySelectorAll(":scope > [data-infinite-item]"));
          var more = list.querySelector(":scope > [data-infinite-more]");
          items.forEach(function (item, index) {
            item.classList.toggle("is-infinite-hidden", index >= visible);
          });
          if (more) {
            more.classList.toggle("is-hidden", visible >= items.length);
            if (more.dataset.infiniteReady !== "true") {
              more.dataset.infiniteReady = "true";
              more.addEventListener("click", function () {
                var currentVisible = parseInt(list.dataset.infiniteVisible || String(step), 10);
                list.dataset.infiniteVisible = String(currentVisible + step);
                initInfiniteLists(list);
              });
            }
          }
        });
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
          coverNode.style.backgroundImage = 'url("' + track.cover_url + '")';
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
          link.dataset.mainNav = "";
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
          button.dataset.id = track.id || "";
          button.dataset.src = track.audio_url || "";
          button.dataset.title = track.title || "";
          button.dataset.artist = track.artist || "Echo 用户";
          button.dataset.cover = track.cover_theme || "summer";
          button.dataset.coverUrl = track.cover_url || "";
          appendTrackCover(button, track);
          var meta = document.createElement("span");
          meta.className = "min-w-0";
          var title = document.createElement("span");
          title.className = "block truncate text-base font-bold";
          title.textContent = track.title || "未命名音频";
          var artist = document.createElement("span");
          artist.className = "block truncate text-sm text-zinc-500 dark:text-zinc-400";
          artist.textContent = "歌曲 · " + (track.artist || "Echo 用户");
          meta.append(title, artist);
          var plus = document.createElement("span");
          plus.className = "grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition group-hover:bg-zinc-200 group-hover:text-zinc-950 dark:group-hover:bg-zinc-700 dark:group-hover:text-white";
          plus.innerHTML = '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>';
          button.append(meta, plus);
          topSearchSuggestions.appendChild(button);
        });

        (payload.playlists || []).forEach(function (playlist) {
          hasContent = true;
          var link = document.createElement("a");
          link.className = "group grid w-full grid-cols-[48px_minmax(0,1fr)_32px] items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-zinc-100 dark:hover:bg-zinc-800";
          link.href = playlist.url || searchUrlFor(query);
          link.dataset.mainNav = "";
          var coverNode = document.createElement("span");
          coverNode.className = "grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-cover bg-center text-white";
          if (playlist.cover_url) {
            coverNode.style.backgroundImage = 'url("' + playlist.cover_url + '")';
          } else {
            coverNode.classList.add("cover-" + (playlist.cover_theme || "eclipse"));
            coverNode.textContent = "♫";
          }
          var meta = document.createElement("span");
          meta.className = "min-w-0";
          var playlistTitle = document.createElement("span");
          playlistTitle.className = "block truncate text-base font-bold";
          playlistTitle.textContent = playlist.title || "未命名歌单";
          var playlistMeta = document.createElement("span");
          playlistMeta.className = "block truncate text-sm text-zinc-500 dark:text-zinc-400";
          playlistMeta.textContent = "歌单 · " + (playlist.creator || "Echo 用户") + " · " + (playlist.track_count || 0) + " 首";
          meta.append(playlistTitle, playlistMeta);
          var arrow = document.createElement("span");
          arrow.className = "grid h-8 w-8 place-items-center rounded-full text-zinc-500 transition group-hover:bg-zinc-200 group-hover:text-zinc-950 dark:group-hover:bg-zinc-700 dark:group-hover:text-white";
          arrow.innerHTML = '<svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 18l6-6-6-6"/></svg>';
          link.append(coverNode, meta, arrow);
          topSearchSuggestions.appendChild(link);
        });

        if (!hasContent && query) {
          var empty = document.createElement("a");
          empty.className = "flex items-center gap-4 rounded-lg px-3 py-3 transition hover:bg-zinc-100 dark:hover:bg-zinc-800";
          empty.href = searchUrlFor(query);
          empty.dataset.mainNav = "";
          appendSuggestionIcon(empty);
          var emptyText = document.createElement("span");
          var emptyTitle = document.createElement("span");
          emptyTitle.className = "block font-bold";
          emptyTitle.textContent = query;
          var emptyMeta = document.createElement("span");
          emptyMeta.className = "block text-sm text-zinc-500 dark:text-zinc-400";
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
      document.addEventListener("click", function (event) {
        const link = event.target.closest("a[data-main-nav]");
        if (!link || event.defaultPrevented) return;
        if (link.hasAttribute("hx-get")) return;
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (link.target && link.target !== "_self") return;
        const url = new URL(link.href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        event.preventDefault();
        loadMainContentUrl(url.pathname + url.search + url.hash);
      });
      document.addEventListener("submit", function (event) {
        const form = event.target.closest("form[data-main-nav-form]");
        if (!form) return;
        const url = urlFromMainNavForm(form);
        if (!url) return;
        event.preventDefault();
        loadMainContentUrl(url);
      });

      applyTheme(readPersistedValue("echo_theme", root.dataset.echoTheme || "dark"));
      applySidebar(localStorage.getItem("echo_sidebar_collapsed") === "true");
      applyContext(true);
      restorePersistedPlayQueue();
      if (playQueue.length) renderPlayQueue();
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
          initTrack = playlistTrackAtQueueIndex(playQueueIndex, storedTrackId);
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
          setPlayQueue(queueContext.queue, initTrack.dataset.id, queueContext.name, queueContext.index);
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
          setAccountMenu(false);
          setCreateMenu(!libraryCreate.classList.contains("is-open"));
        });
      }
      if (accountMenuTrigger) {
        accountMenuTrigger.addEventListener("click", function (event) {
          event.stopPropagation();
          setCreateMenu(false);
          setAccountMenu(!accountMenu.classList.contains("is-open"));
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
        if (accountMenu && !accountMenu.contains(event.target)) setAccountMenu(false);
        if (topSearchSuggestions && topSearchForm && !topSearchForm.contains(event.target) && !topSearchSuggestions.contains(event.target)) {
          hideTopSearchSuggestions();
        }
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          setCreateMenu(false);
          setAccountMenu(false);
          hideTopSearchSuggestions();
        }
      });
      document.body.addEventListener("click", function (event) {
        var comingSoonTrigger = event.target.closest("[data-coming-soon]");
        if (!comingSoonTrigger) return;
        event.preventDefault();
        showToast(comingSoonTrigger.dataset.comingSoon + " 功能正在设计中。", "info");
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
      progress.addEventListener("pointerdown", beginProgressSeek);
      progress.addEventListener("pointerup", finishProgressSeek);
      progress.addEventListener("pointercancel", cancelProgressSeek);
      progress.addEventListener("input", function () {
        isSeeking = true;
        commitProgressSeek();
      });
      progress.addEventListener("change", function () {
        commitProgressSeek();
        isSeeking = false;
      });
      progress.addEventListener("mousedown", function () {
        if (window.PointerEvent) return;
        beginProgressSeek();
      });
      document.addEventListener("mouseup", function () {
        if (window.PointerEvent) return;
        finishProgressSeek();
      });
      progress.addEventListener("touchstart", function () {
        if (window.PointerEvent) return;
        beginProgressSeek();
      }, { passive: false });
      document.addEventListener("touchend", function () {
        if (window.PointerEvent) return;
        finishProgressSeek();
      }, { passive: false });
      document.addEventListener("touchcancel", function () {
        if (window.PointerEvent) return;
        cancelProgressSeek();
      });
      audio.addEventListener("seeked", function () {
        if (!hasUsableDuration()) return;
        if (isSeeking) return;
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
        if (hasUsableDuration() && !isSeeking && !audio.seeking) {
          progress.value = String(audio.currentTime);
          current.textContent = formatTime(audio.currentTime);
        }
        persistPlaybackState(false);
        if (isSeeking) {
          syncLyricsActiveLine(progressTime(), false);
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
        if (!event.target.closest("#echo-track-context-menu")) hideTrackContextMenu();
        const likeButton = event.target.closest("[data-comment-like]");
        if (likeButton) {
          event.preventDefault();
          toggleCommentLike(likeButton);
          return;
        }

        const trackLikeButton = event.target.closest("[data-track-like]");
        if (trackLikeButton) {
          event.preventDefault();
          event.stopPropagation();
          toggleTrackLike(trackLikeButton);
          return;
        }

        const replyButton = event.target.closest("[data-reply-toggle]");
        if (replyButton) {
          event.preventDefault();
          toggleReplyForm(replyButton);
          return;
        }

        const copyUrlButton = event.target.closest("[data-copy-url]");
        if (copyUrlButton) {
          event.preventDefault();
          copyTextToClipboard(copyUrlButton.dataset.copyUrl || window.location.href, "歌单链接已复制。");
          return;
        }

        const playAllButton = event.target.closest("[data-playlist-play-all]");
        if (playAllButton) {
          const container = playAllButton.closest(".playlist-detail-page");
          const queueHolder = container ? container.querySelector("[data-play-queue]") : null;
          const firstTrack = queueHolder ? queueHolder.querySelector("[data-echo-track]") : null;
          if (firstTrack) {
            var allQueueContext = resolveQueueContext(firstTrack);
            playTrack(trackFromElement(firstTrack), {
              source: "playlist-play-all",
              queue: allQueueContext.queue,
              queueName: allQueueContext.name,
              queueIndex: allQueueContext.index,
            });
          }
          return;
        }

        const playlistNextButton = event.target.closest("[data-playlist-next]");
        if (playlistNextButton) {
          event.preventDefault();
          var nextRow = playlistNextButton.closest("[data-playlist-row]");
          var nextTrigger = nextRow ? nextRow.querySelector("[data-echo-track]") : null;
          insertTrackInPlayQueue(trackFromElement(nextTrigger), "next");
          return;
        }

        const playlistLikeButton = event.target.closest("[data-playlist-like]");
        if (playlistLikeButton) {
          event.preventDefault();
          var likeRow = playlistLikeButton.closest("[data-playlist-row]");
          var rowLikeButton = likeRow ? likeRow.querySelector("[data-track-like]") : null;
          if (rowLikeButton) toggleTrackLike(rowLikeButton);
          return;
        }

        const playlistMoreButton = event.target.closest("[data-playlist-more]");
        if (playlistMoreButton) {
          event.preventDefault();
          var moreRow = playlistMoreButton.closest("[data-playlist-row]");
          var moreTrigger = moreRow ? moreRow.querySelector("[data-echo-track]") : null;
          if (moreTrigger) showTrackContextMenu(event, moreTrigger);
          return;
        }

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
      document.body.addEventListener("pointerdown", function (event) {
        pointerActivatedTrack = Boolean(event.target.closest("[data-echo-track]"));
        var sortableRow = playlistSortableRow(event.target);
        if (sortableRow) {
          window.clearTimeout(playlistLongPressTimer);
          playlistLongPressTimer = window.setTimeout(function () {
            enablePlaylistDrag(sortableRow);
          }, 320);
        }
      }, true);
      document.body.addEventListener("pointerup", function () {
        window.clearTimeout(playlistLongPressTimer);
      }, true);
      document.body.addEventListener("pointercancel", function () {
        window.clearTimeout(playlistLongPressTimer);
      }, true);
      document.body.addEventListener("dragstart", function (event) {
        var row = event.target.closest("[data-playlist-sortable='true']");
        if (!row || row.getAttribute("draggable") !== "true") {
          event.preventDefault();
          return;
        }
        playlistDragRow = row;
        row.classList.add("is-dragging");
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", row.dataset.rowPosition || "");
        }
      });
      document.body.addEventListener("dragover", function (event) {
        if (!playlistDragRow) return;
        var targetRow = event.target.closest("[data-playlist-sortable='true']");
        if (!targetRow || targetRow === playlistDragRow) return;
        event.preventDefault();
        clearPlaylistDropMarks();
        var rect = targetRow.getBoundingClientRect();
        targetRow.classList.add(event.clientY < rect.top + rect.height / 2 ? "is-drop-before" : "is-drop-after");
      });
      document.body.addEventListener("drop", function (event) {
        if (!playlistDragRow) return;
        var targetRow = event.target.closest("[data-playlist-sortable='true']");
        if (!targetRow || targetRow === playlistDragRow) return;
        event.preventDefault();
        var rows = Array.from(targetRow.parentElement.querySelectorAll("[data-playlist-sortable='true']"));
        var targetIndex = rows.indexOf(targetRow);
        if (targetRow.classList.contains("is-drop-after")) targetIndex += 1;
        submitPlaylistReorder(playlistDragRow, targetIndex);
      });
      document.body.addEventListener("dragend", function () {
        if (playlistDragRow) {
          playlistDragRow.classList.remove("is-dragging", "is-drag-ready");
          playlistDragRow.removeAttribute("draggable");
        }
        playlistDragRow = null;
        clearPlaylistDropMarks();
      });
      document.body.addEventListener("contextmenu", function (event) {
        var trigger = event.target.closest("[data-echo-track]");
        if (!trigger) {
          var row = event.target.closest("[data-track-row]");
          trigger = row ? row.querySelector("[data-echo-track]") : null;
        }
        if (!trigger) {
          hideTrackContextMenu();
          return;
        }
        showTrackContextMenu(event, trigger);
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") hideTrackContextMenu();
      });
      window.addEventListener("resize", hideTrackContextMenu);
      document.addEventListener("scroll", hideTrackContextMenu, true);
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
        initPlaylistTabs(document);
        initInfiniteLists(document);
      });
      initPlaylistTabs(document);
      initInfiniteLists(document);
      syncMainResourceState();
      syncLyricsPanelTheme();
    })();
