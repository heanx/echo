(function () {
  function create(options) {
    const clampNumber = window.EchoShellUtils.clampNumber;
    const root = options.root;
    const shell = options.shell;
    const leftSidebar = options.leftSidebar;
    const contextPanel = options.contextPanel;
    const openPlaylist = options.openPlaylist;
    const libraryTrigger = options.libraryTrigger;
    const libraryCreate = options.libraryCreate;
    const libraryCreateButton = options.libraryCreateButton;
    const libraryCreateMenu = options.libraryCreateMenu;
    const accountMenu = options.accountMenu;
    const accountMenuTrigger = options.accountMenuTrigger;
    const accountMenuPanel = options.accountMenuPanel;
    const topBar = options.topBar;
    const topSearchWrap = options.topSearchWrap;
    const playbackBar = options.playbackBar;
    const playbackControls = options.playbackControls;
    const playbackActions = options.playbackActions;

    function updateShellLayout() {
      if (!shell || !leftSidebar || !contextPanel) return;
      const viewportWidth = root.clientWidth;
      const sidebarCollapsed = localStorage.getItem("echo_sidebar_collapsed") === "true";
      const contextCollapsed = options.isContextCollapsed();
      const showLeft = viewportWidth >= 760;
      const leftWidth = showLeft ? (sidebarCollapsed ? 76 : Math.round(clampNumber(viewportWidth * 0.22, 248, 320))) : 0;
      const rightCandidate = contextCollapsed ? 76 : Math.round(clampNumber(viewportWidth * 0.2, 248, 360));
      const showContext = showLeft && viewportWidth - leftWidth - rightCandidate >= 560;
      const rightWidth = showContext ? rightCandidate : 0;
      shell.style.setProperty("--left-width", leftWidth + "px");
      shell.style.setProperty("--right-width", rightWidth + "px");
      shell.style.gridTemplateColumns = [showLeft ? "var(--left-width)" : "", "minmax(0, 1fr)", showContext ? "var(--right-width)" : ""].filter(Boolean).join(" ");
      shell.classList.toggle("layout-has-left", showLeft);
      shell.classList.toggle("layout-no-left", !showLeft);
      shell.classList.toggle("layout-has-context", showContext);
      shell.classList.toggle("layout-no-context", !showContext);
      shell.classList.toggle("context-closed", !showContext);
      leftSidebar.classList.toggle("is-compact", showLeft && !sidebarCollapsed && leftWidth < 280);
      contextPanel.style.display = showContext ? "" : "none";
      if (openPlaylist) {
        openPlaylist.setAttribute("aria-pressed", showContext ? "true" : "false");
        openPlaylist.classList.toggle("text-brand", showContext && options.currentContextView() === "playlist");
      }
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
      const minShift = logoRect.right + gap - (wrapCenterX - clusterWidth / 2);
      const maxShift = actionsRect.left - gap - (wrapCenterX + clusterWidth / 2);
      const shift = minShift <= maxShift ? clampNumber(centerX - wrapCenterX, minShift, maxShift) : 0;
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
      const progressPadding = root.clientWidth < 640 ? 12 : 88;
      const progressWidth = clampNumber(Math.round(playbackControls.offsetWidth - progressPadding), 128, 520);
      const actionWidth = playbackActions ? playbackActions.offsetWidth : 0;
      playbackBar.style.setProperty("--player-progress-width", progressWidth + "px");
      playbackBar.style.setProperty("--player-volume-width", clampNumber(Math.round(actionWidth * 0.32), 56, 128) + "px");
    }

    function queuePlaybackLayout() {
      requestAnimationFrame(function () {
        updatePlaybackLayout();
        requestAnimationFrame(updatePlaybackLayout);
      });
    }

    function positionCreateMenu() {
      if (!libraryCreateButton || !libraryCreateMenu) return;
      const gap = 12;
      const margin = 12;
      const buttonRect = libraryCreateButton.getBoundingClientRect();
      const sidebarRect = leftSidebar.getBoundingClientRect();
      const viewportWidth = root.clientWidth;
      const menuWidth = Math.min(420, Math.max(280, viewportWidth - margin * 2));
      const rightOpeningLeft = (leftSidebar.classList.contains("is-collapsed") ? sidebarRect.right : buttonRect.right) + gap;
      const left = rightOpeningLeft + menuWidth <= viewportWidth - margin
        ? rightOpeningLeft
        : Math.max(margin, Math.min(sidebarRect.right - menuWidth, viewportWidth - menuWidth - margin));
      libraryCreateMenu.style.setProperty("--create-menu-left", Math.round(left) + "px");
      libraryCreateMenu.style.setProperty("--create-menu-top", Math.round(buttonRect.bottom + gap) + "px");
      libraryCreateMenu.style.setProperty("--create-menu-width", Math.round(menuWidth) + "px");
    }

    function applySidebar(collapsed) {
      leftSidebar.classList.toggle("is-collapsed", collapsed);
      if (libraryTrigger) libraryTrigger.setAttribute("aria-label", collapsed ? "展开音乐库" : "音乐库");
      localStorage.setItem("echo_sidebar_collapsed", collapsed ? "true" : "false");
      updateShellLayout();
      queueTopSearchLayout();
    }

    function applyContext() {
      localStorage.setItem("echo_context_panel_open", "true");
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

    function closeAllPlaylistMenus() {
      document.querySelectorAll(".playlist-header-menu-wrapper").forEach(function (wrapper) {
        const menu = wrapper.querySelector("[data-playlist-menu]");
        const trigger = wrapper.querySelector("[data-playlist-menu-trigger]");
        if (menu) menu.classList.remove("is-open");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      });
    }

    function togglePlaylistMenu(wrapper) {
      const menu = wrapper.querySelector("[data-playlist-menu]");
      const trigger = wrapper.querySelector("[data-playlist-menu-trigger]");
      if (!menu || !trigger) return;
      const isOpen = menu.classList.contains("is-open");
      closeAllPlaylistMenus();
      if (!isOpen) {
        menu.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      }
    }

    function updateTooltipDirection(trigger) {
      const tooltip = trigger.querySelector(".echo-tooltip");
      if (!tooltip) return;
      trigger.classList.remove("tooltip-flip-left");
      if (tooltip.getBoundingClientRect().right > root.clientWidth - 8) trigger.classList.add("tooltip-flip-left");
    }

    return {
      applyContext: applyContext,
      applySidebar: applySidebar,
      closeAllPlaylistMenus: closeAllPlaylistMenus,
      positionCreateMenu: positionCreateMenu,
      queuePlaybackLayout: queuePlaybackLayout,
      queueTopSearchLayout: queueTopSearchLayout,
      setAccountMenu: setAccountMenu,
      setCreateMenu: setCreateMenu,
      togglePlaylistMenu: togglePlaylistMenu,
      updateShellLayout: updateShellLayout,
      updateTooltipDirection: updateTooltipDirection,
    };
  }

  window.EchoShellLayout = { create: create };
})();
