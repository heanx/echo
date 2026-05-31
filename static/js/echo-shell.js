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
      let shuffleEnabled = false;
      let repeatMode = "all";
      let playQueue = [];
      let playQueueIndex = -1;
      let playQueueName = "";
      let shufflePool = [];
      let playbackHistory = [];
      let lastPersistedPlaybackSecond = -1;
      let trackLikeStatusRequestId = 0;
      let trackContextSubmenuCloseTimer = 0;

      var lyricDistClasses = ["lyric-dist-0", "lyric-dist-1", "lyric-dist-2", "lyric-dist-3", "lyric-dist-4", "lyric-dist-far"];
      const shellUtils = window.EchoShellUtils;
      const shellPersist = window.EchoShellPersist;
      const clampNumber = shellUtils.clampNumber;
      const formatTime = shellUtils.formatTime;
      const normalizeRepeatMode = shellUtils.normalizeRepeatMode;
      const normalizeTrack = shellUtils.normalizeTrack;
      const queueDisplayName = shellUtils.queueDisplayName;
      const queueIndexForTrack = shellUtils.queueIndexForTrack;
      const repeatModeLabel = shellUtils.repeatModeLabel;
      const readPersistedValue = shellPersist.read;
      const writePersistedValue = shellPersist.write;

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
      const lyricsTheme = window.EchoShellLyricsTheme.create({
        root: root,
        coverThemeColors: coverThemeColors,
      });
      const syncLyricsPanelTheme = lyricsTheme.sync;

      const shellNavigation = window.EchoShellNavigation.create({
        echoConfig: echoConfig,
        getCurrentTrackId: function () { return currentTrackId; },
        showToast: showToast,
        closeMenus: function () {
          setCreateMenu(false);
          setAccountMenu(false);
          hideTopSearchSuggestions();
        },
        afterSwap: function () {
          syncMainResourceState();
          syncLyricsPanelTheme();
          initPlaylistTabs(document);
          initInfiniteLists(document);
        },
        afterResourceSwap: function () {},
      });
      const cancelActiveResourceLoad = shellNavigation.cancelActiveResourceLoad;
      const loadMainContentUrl = shellNavigation.loadMainContentUrl;
      const loadMainResource = shellNavigation.loadMainResource;
      const refreshActiveResource = shellNavigation.refreshActiveResource;
      const resetMainContentToHome = shellNavigation.resetMainContentToHome;
      const urlFromMainNavForm = shellNavigation.urlFromMainNavForm;

      const shellLayout = window.EchoShellLayout.create({
        root: root,
        shell: shell,
        leftSidebar: leftSidebar,
        contextPanel: contextPanel,
        openPlaylist: openPlaylist,
        libraryTrigger: libraryTrigger,
        libraryCreate: libraryCreate,
        libraryCreateButton: libraryCreateButton,
        libraryCreateMenu: libraryCreateMenu,
        accountMenu: accountMenu,
        accountMenuTrigger: accountMenuTrigger,
        accountMenuPanel: accountMenuPanel,
        topBar: topBar,
        topSearchWrap: topSearchWrap,
        playbackBar: playbackBar,
        playbackControls: playbackControls,
        playbackActions: playbackActions,
        currentContextView: currentContextView,
        isContextCollapsed: isContextCollapsed,
      });
      const applyContext = shellLayout.applyContext;
      const applySidebar = shellLayout.applySidebar;
      const closeAllPlaylistMenus = shellLayout.closeAllPlaylistMenus;
      const positionCreateMenu = shellLayout.positionCreateMenu;
      const queuePlaybackLayout = shellLayout.queuePlaybackLayout;
      const queueTopSearchLayout = shellLayout.queueTopSearchLayout;
      const setAccountMenu = shellLayout.setAccountMenu;
      const setCreateMenu = shellLayout.setCreateMenu;
      const togglePlaylistMenu = shellLayout.togglePlaylistMenu;
      const updateShellLayout = shellLayout.updateShellLayout;
      const updateTooltipDirection = shellLayout.updateTooltipDirection;

      function applyTheme(theme) {
        var normalizedTheme = theme === "light" ? "light" : "dark";
        root.classList.toggle("dark", normalizedTheme !== "light");
        root.dataset.echoTheme = normalizedTheme;
        writePersistedValue("echo_theme", normalizedTheme);
        syncLyricsPanelTheme();
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

      const shellSearch = window.EchoShellSearch.create({
        echoConfig: echoConfig,
        topSearchInput: topSearchInput,
        topSearchClear: topSearchClear,
        topSearchSuggestions: topSearchSuggestions,
      });
      const hideTopSearchSuggestions = shellSearch.hide;
      const requestTopSearchSuggestions = shellSearch.request;
      const syncTopSearchClear = shellSearch.syncClear;

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
        document.querySelectorAll(".playlist-header-menu-wrapper").forEach(function (wrapper) {
          if (!wrapper.contains(event.target)) {
            var menu = wrapper.querySelector("[data-playlist-menu]");
            var trigger = wrapper.querySelector("[data-playlist-menu-trigger]");
            if (menu) menu.classList.remove("is-open");
            if (trigger) trigger.setAttribute("aria-expanded", "false");
          }
        });
        if (topSearchSuggestions && topSearchForm && !topSearchForm.contains(event.target) && !topSearchSuggestions.contains(event.target)) {
          hideTopSearchSuggestions();
        }
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
          setCreateMenu(false);
          setAccountMenu(false);
          closeAllPlaylistMenus();
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

        const playlistMenuTrigger = event.target.closest("[data-playlist-menu-trigger]");
        if (playlistMenuTrigger) {
          event.preventDefault();
          event.stopPropagation();
          var wrapper = playlistMenuTrigger.closest(".playlist-header-menu-wrapper");
          if (wrapper) togglePlaylistMenu(wrapper);
          return;
        }

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

        const copyLinkButton = event.target.closest("[data-copy-link]");
        if (copyLinkButton) {
          event.preventDefault();
          closeAllPlaylistMenus();
          copyTextToClipboard(window.location.href, "链接已复制");
          return;
        }

        const deletePlaylistButton = event.target.closest("[data-delete-playlist]");
        if (deletePlaylistButton) {
          event.preventDefault();
          closeAllPlaylistMenus();
          if (!window.confirm("确定删除这个歌单吗？\n\n删除后无法恢复，但不会删除歌单中的歌曲。")) return;
          var deleteForm = document.createElement("form");
          deleteForm.method = "POST";
          deleteForm.action = deletePlaylistButton.dataset.deleteUrl;
          deleteForm.style.display = "none";
          var csrfInput = document.createElement("input");
          csrfInput.type = "hidden";
          csrfInput.name = "csrfmiddlewaretoken";
          csrfInput.value = (window.EchoConfig && window.EchoConfig.csrfToken) || "";
          deleteForm.appendChild(csrfInput);
          document.body.appendChild(deleteForm);
          deleteForm.submit();
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
