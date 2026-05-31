(function () {
  function create(options) {
    let activeResourceAbort = null;
    let mainResourceRequestId = 0;

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
      options.afterSwap();
      if (url) history.pushState({}, "", url);
      return true;
    }

    function loadMainResource(resourceName, trackId) {
      if (!resourceName || !trackId) return;
      cancelActiveResourceLoad();
      const baseUrl = resourceName === "comments" ? options.echoConfig.commentsUrl : options.echoConfig.lyricsUrl;
      const url = baseUrl + "?track=" + encodeURIComponent(trackId);
      const controller = new AbortController();
      const requestId = mainResourceRequestId;
      activeResourceAbort = controller;
      fetch(url, { cache: "no-store", headers: { "HX-Request": "true" }, signal: controller.signal })
        .then(function (response) { return response.text(); })
        .then(function (html) {
          if (controller.signal.aborted || requestId !== mainResourceRequestId) return;
          if (String(options.getCurrentTrackId()) !== String(trackId)) return;
          if (applyMainContentSwap(html, url)) options.afterResourceSwap();
        })
        .catch(function (error) {
          if (!error || error.name !== "AbortError") options.showToast("内容加载失败，请稍后再试。", "error");
        })
        .finally(function () {
          if (activeResourceAbort === controller) activeResourceAbort = null;
        });
    }

    function refreshActiveResource(trackId) {
      if (!trackId) return;
      const activeResource = document.querySelector("#main-content [data-echo-resource]");
      if (activeResource) loadMainResource(activeResource.dataset.echoResource, trackId);
    }

    function loadMainContentUrl(url) {
      if (!url) return false;
      if (mainContentHasDirtyForm() && !window.confirm("当前页面有未保存的编辑内容，确定要离开吗？")) return false;
      options.closeMenus();
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
          options.showToast("内容加载失败，已切换为完整页面。", "error");
          window.location.href = url;
        });
      return false;
    }

    function urlFromMainNavForm(form) {
      const action = form.getAttribute("action") || window.location.pathname;
      const method = (form.getAttribute("method") || "get").toLowerCase();
      if (method !== "get") return "";
      const url = new URL(action, window.location.origin);
      url.search = new URLSearchParams(new FormData(form)).toString();
      return url.pathname + url.search + url.hash;
    }

    function resetMainContentToHome() {
      if (mainContentHasDirtyForm() && !window.confirm("当前页面有未保存的编辑内容，确定要回到首页吗？")) return false;
      options.closeMenus();
      fetch(options.echoConfig.homeUrl, { cache: "no-store", headers: { "HX-Request": "true" } })
        .then(function (response) { return response.text(); })
        .then(function (html) {
          if (!applyMainContentSwap(html, options.echoConfig.homeUrl)) window.location.href = options.echoConfig.homeUrl;
        })
        .catch(function () {
          options.showToast("首页加载失败，已为你切回完整页面。", "error");
          window.location.href = options.echoConfig.homeUrl;
        });
      return false;
    }

    return {
      cancelActiveResourceLoad: cancelActiveResourceLoad,
      loadMainContentUrl: loadMainContentUrl,
      loadMainResource: loadMainResource,
      refreshActiveResource: refreshActiveResource,
      resetMainContentToHome: resetMainContentToHome,
      urlFromMainNavForm: urlFromMainNavForm,
    };
  }

  window.EchoShellNavigation = { create: create };
})();
