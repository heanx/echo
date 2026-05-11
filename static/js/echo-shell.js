    (function () {
      const root = document.documentElement;
      const echoConfig = window.EchoConfig || {};
      const topBar = document.getElementById("top-bar");
      const topSearchWrap = document.querySelector(".top-search-wrap");
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
      const cover = document.getElementById("player-cover");
      const sideCover = document.getElementById("side-cover");
      const sideTitle = document.getElementById("side-title");
      const sideArtist = document.getElementById("side-artist");
      const playlistTrackList = document.getElementById("playlist-track-list");
      const toggle = document.getElementById("player-toggle");
      const prevButton = toggle ? toggle.previousElementSibling : null;
      const nextButton = toggle ? toggle.nextElementSibling : null;
      const playIcon = document.getElementById("player-play-icon");
      const pauseIcon = document.getElementById("player-pause-icon");
      const lyricsNav = document.getElementById("lyrics-nav");
      const commentsNav = document.getElementById("comments-nav");
      const coverClasses = ["cover-summer", "cover-city", "cover-eclipse", "cover-sea", "cover-ocean", "cover-signal", "cover-sunset", "cover-forest", "cover-night"];
      const contextViewLabels = { now: "正在播放", playlist: "播放列表" };
      let contextViewStack = ["now"];
      let pointerActivatedTrack = false;
      let currentTrackId = "";
      let playReportKey = "";
      let isSeeking = false;
      let pendingSeekTime = null;
      let lastLyricActiveIndex = -1;
      let lastUserScrollTime = 0;
      let lastAutoScrollTime = 0;
      let activeResourceAbort = null;
      let mainResourceRequestId = 0;

      var lyricDistClasses = ["lyric-dist-0", "lyric-dist-1", "lyric-dist-2", "lyric-dist-3", "lyric-dist-4", "lyric-dist-far"];

      function formatTime(value) {
        if (!Number.isFinite(value)) return "--:--";
        const minutes = Math.floor(value / 60);
        const seconds = Math.floor(value % 60).toString().padStart(2, "0");
        return minutes + ":" + seconds;
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
        currentTrackId = trackId;
        localStorage.setItem("echo_current_track_id", trackId);

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
            var active = item.dataset.id === String(trackId);
            item.classList.toggle("is-active", active);
            item.setAttribute("aria-current", active ? "true" : "false");
          });
        }
      }
      function trackFromElement(element) {
        if (!element) return null;
        return {
          src: element.dataset.src,
          id: element.dataset.id,
          title: element.dataset.title,
          artist: element.dataset.artist,
          cover: element.dataset.cover,
          coverUrl: element.dataset.coverUrl,
        };
      }
      function playlistTracks() {
        if (!playlistTrackList) return [];
        return Array.from(playlistTrackList.querySelectorAll(".playlist-track[data-echo-track]"));
      }
      function playPlaylistOffset(offset) {
        const tracks = playlistTracks().filter(function (item) {
          return item.dataset.src;
        });
        if (!tracks.length) return;
        let currentIndex = tracks.findIndex(function (item) {
          return String(item.dataset.id) === String(currentTrackId);
        });
        if (currentIndex < 0) currentIndex = offset > 0 ? -1 : 0;
        const nextIndex = (currentIndex + offset + tracks.length) % tracks.length;
        playTrack(trackFromElement(tracks[nextIndex]));
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
              history.pushState({}, "", url);
            }
          })
          .catch(function () {})
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
            window.location.href = echoConfig.homeUrl;
          });
        return false;
      }
      function applyTheme(theme) {
        root.classList.toggle("dark", theme !== "light");
        localStorage.setItem("echo_theme", theme !== "light" ? "dark" : "light");
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
        setCurrentTrack(track.id || "");
        playReportKey = "";
        lastLyricActiveIndex = -1;
        resetProgress();
        title.textContent = track.title || "未命名音频";
        artist.textContent = track.artist || "Echo 用户";
        sideTitle.textContent = title.textContent;
        sideArtist.textContent = artist.textContent;
        setCover(cover, track.cover || "summer", track.coverUrl || "");
        setCover(sideCover, track.cover || "summer", track.coverUrl || "");
        refreshActiveResource(track.id);
        if (track.src) {
          audio.src = track.src;
        }
      }
      function playTrack(track) {
        selectTrack(track);
        if (track && track.src) {
          audio.play().catch(function () {});
        }
        setPlaying(true);
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

      applyTheme(localStorage.getItem("echo_theme") || "dark");
      applySidebar(localStorage.getItem("echo_sidebar_collapsed") === "true");
      applyContext(true);
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
      var storedTrackId = localStorage.getItem("echo_current_track_id") || "";
      if (playlistTrackList) {
        var initTrack = null;
        if (urlTrackId) {
          initTrack = playlistTrackList.querySelector('.playlist-track[data-echo-track][data-id="' + CSS.escape(String(urlTrackId)) + '"]');
        }
        if (!initTrack) {
          initTrack = playlistTrackList.querySelector(".playlist-track[data-echo-track]");
        }
        if (initTrack) {
          selectTrack(trackFromElement(initTrack));
        } else if (urlTrackId) {
          setCurrentTrack(urlTrackId);
        }
      } else if (urlTrackId || storedTrackId) {
        setCurrentTrack(urlTrackId || storedTrackId);
      }
      audio.volume = Number(localStorage.getItem("echo_player_volume") || "0.72");
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
      });
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") setCreateMenu(false);
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
          localStorage.setItem("echo_player_volume", volume.value);
        });
      }
      var resolvePlaybackTrackId = function () {
        var urlParams = new URLSearchParams(window.location.search);
        return currentTrackId || localStorage.getItem("echo_current_track_id") || urlParams.get("track") || "";
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
      if (prevButton) {
        prevButton.addEventListener("click", function () {
          playPlaylistOffset(-1);
        });
      }
      if (nextButton) {
        nextButton.addEventListener("click", function () {
          playPlaylistOffset(1);
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
        syncLyricsActiveLine();
      });
      audio.addEventListener("loadedmetadata", function () {
        syncProgressMetadata();
      });
      audio.addEventListener("durationchange", function () {
        syncProgressMetadata();
      });
      audio.addEventListener("emptied", function () {
        resetProgress();
      });
      audio.addEventListener("timeupdate", function () {
        if (hasUsableDuration() && !isSeeking) {
          progress.value = String(audio.currentTime);
          current.textContent = formatTime(audio.currentTime);
        }
        if (isSeeking) {
          syncLyricsActiveLine(pendingSeekTime !== null ? pendingSeekTime : progressTime(), false);
        } else {
          syncLyricsActiveLine();
        }
      });
      audio.addEventListener("play", function () {
        setPlaying(true);
        reportTrackPlay();
      });
      audio.addEventListener("pause", function () { setPlaying(false); });
      audio.addEventListener("ended", function () {
        playPlaylistOffset(1);
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
        playTrack(trackFromElement(trigger));
        if (pointerActivatedTrack && trigger.closest("#playlist-track-list")) {
          trigger.blur();
        }
        pointerActivatedTrack = false;
      });
      document.body.addEventListener("pointerdown", function (event) {
        pointerActivatedTrack = Boolean(event.target.closest("[data-echo-track]"));
      }, true);
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
      document.addEventListener("htmx:afterSettle", function () {
        syncMainResourceState();
      });
      syncMainResourceState();
    })();
