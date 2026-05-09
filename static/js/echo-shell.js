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
      const playIcon = document.getElementById("player-play-icon");
      const pauseIcon = document.getElementById("player-pause-icon");
      const lyricsNav = document.getElementById("lyrics-nav");
      const commentsNav = document.getElementById("comments-nav");
      const coverClasses = ["cover-summer", "cover-city", "cover-eclipse", "cover-sea", "cover-ocean", "cover-signal", "cover-sunset", "cover-forest", "cover-night"];
      const contextViewLabels = { now: "正在播放", playlist: "播放列表" };
      let contextViewStack = ["now"];
      let pointerActivatedTrack = false;

      function formatTime(value) {
        if (!Number.isFinite(value)) return "--:--";
        const minutes = Math.floor(value / 60);
        const seconds = Math.floor(value % 60).toString().padStart(2, "0");
        return minutes + ":" + seconds;
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
      function setTrackResourceLinks(trackId) {
        if (!trackId) return;
        const lyricsUrl = echoConfig.lyricsUrl + "?track=" + encodeURIComponent(trackId);
        const commentsUrl = echoConfig.commentsUrl + "?track=" + encodeURIComponent(trackId);
        if (lyricsNav) {
          lyricsNav.setAttribute("hx-get", lyricsUrl);
          lyricsNav.setAttribute("href", lyricsUrl);
        }
        if (commentsNav) {
          commentsNav.setAttribute("hx-get", commentsUrl);
          commentsNav.setAttribute("href", commentsUrl);
        }
        localStorage.setItem("echo_current_track_id", trackId);
      }
      function updateActivePlaylistTrack(trackId) {
        if (!playlistTrackList) return;
        playlistTrackList.querySelectorAll(".playlist-track").forEach(function (item) {
          const active = Boolean(trackId) && item.dataset.id === String(trackId);
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-current", active ? "true" : "false");
        });
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
      function refreshActiveResource(trackId) {
        if (!trackId) return;
        const activeResource = document.querySelector("#main-content [data-echo-resource]");
        if (!activeResource) return;
        const resourceName = activeResource.dataset.echoResource;
        const baseUrl = resourceName === "comments" ? echoConfig.commentsUrl : echoConfig.lyricsUrl;
        const url = baseUrl + "?track=" + encodeURIComponent(trackId);
        fetch(url, { cache: "no-store", headers: { "HX-Request": "true" } })
          .then(function (response) { return response.text(); })
          .then(function (html) {
            const doc = new DOMParser().parseFromString(html, "text/html");
            const nextMain = doc.querySelector("#main-content");
            const currentMain = document.getElementById("main-content");
            if (nextMain && currentMain) {
              currentMain.outerHTML = nextMain.outerHTML;
              history.pushState({}, "", url);
            }
          })
          .catch(function () {});
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
      function playTrack(track) {
        title.textContent = track.title || "未命名音频";
        artist.textContent = track.artist || "Echo 用户";
        sideTitle.textContent = title.textContent;
        sideArtist.textContent = artist.textContent;
        setCover(cover, track.cover || "summer", track.coverUrl || "");
        setCover(sideCover, track.cover || "summer", track.coverUrl || "");
        updateActivePlaylistTrack(track.id);
        setTrackResourceLinks(track.id);
        refreshActiveResource(track.id);
        if (track.src) {
          audio.src = track.src;
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
      setTrackResourceLinks(localStorage.getItem("echo_current_track_id"));
      updateActivePlaylistTrack(localStorage.getItem("echo_current_track_id"));
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
      toggle.addEventListener("click", function () {
        if (!audio.src) return;
        audio.paused ? audio.play() : audio.pause();
      });
      progress.addEventListener("input", function () {
        if (audio.duration) audio.currentTime = Number(progress.value);
      });
      audio.addEventListener("loadedmetadata", function () {
        if (Number.isFinite(audio.duration)) {
          progress.max = Math.floor(audio.duration);
          duration.textContent = formatTime(audio.duration);
        }
      });
      audio.addEventListener("timeupdate", function () {
        if (Number.isFinite(audio.duration)) {
          progress.value = Math.floor(audio.currentTime);
          current.textContent = formatTime(audio.currentTime);
        }
      });
      audio.addEventListener("play", function () { setPlaying(true); });
      audio.addEventListener("pause", function () { setPlaying(false); });
      document.body.addEventListener("click", function (event) {
        const trigger = event.target.closest("[data-echo-track]");
        if (!trigger) return;
        playTrack({
          src: trigger.dataset.src,
          id: trigger.dataset.id,
          title: trigger.dataset.title,
          artist: trigger.dataset.artist,
          cover: trigger.dataset.cover,
          coverUrl: trigger.dataset.coverUrl,
        });
        if (pointerActivatedTrack && trigger.closest("#playlist-track-list")) {
          trigger.blur();
        }
        pointerActivatedTrack = false;
      });
      document.body.addEventListener("pointerdown", function (event) {
        pointerActivatedTrack = Boolean(event.target.closest("[data-echo-track]"));
      }, true);
    })();
