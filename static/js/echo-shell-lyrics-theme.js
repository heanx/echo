(function () {
  function create(options) {
    const root = options.root;
    const coverThemeColors = options.coverThemeColors;

    function clampChannel(value) {
      return Math.max(0, Math.min(255, Math.round(value)));
    }

    function mixRgb(rgb, target, amount) {
      return [
        clampChannel(rgb[0] + (target[0] - rgb[0]) * amount),
        clampChannel(rgb[1] + (target[1] - rgb[1]) * amount),
        clampChannel(rgb[2] + (target[2] - rgb[2]) * amount),
      ];
    }

    function applyTheme(panel, rgb) {
      if (!panel || !rgb) return;
      const isDark = root.classList.contains("dark");
      const adjusted = mixRgb(rgb, isDark ? [0, 0, 0] : [255, 255, 255], 0.10);
      const deep = mixRgb(adjusted, isDark ? [0, 0, 0] : [255, 255, 255], isDark ? 0.24 : 0.16);
      panel.style.setProperty("--lyrics-surface", "rgb(" + adjusted.join(", ") + ")");
      panel.style.setProperty("--lyrics-surface-soft", "rgb(" + deep.join(", ") + ")");
    }

    function cacheKey(imageUrl) {
      return "echo_cover_color:" + imageUrl;
    }

    function readCached(imageUrl) {
      if (!imageUrl) return null;
      try {
        const parsed = JSON.parse(localStorage.getItem(cacheKey(imageUrl)) || "");
        return Array.isArray(parsed) && parsed.length === 3 ? parsed.map(clampChannel) : null;
      } catch (_error) {
        return null;
      }
    }

    function writeCached(imageUrl, rgb) {
      if (!imageUrl || !rgb) return;
      try {
        localStorage.setItem(cacheKey(imageUrl), JSON.stringify(rgb.map(clampChannel)));
      } catch (_error) {}
    }

    function readDominantColor(imageUrl) {
      return new Promise(function (resolve, reject) {
        if (!imageUrl) return reject(new Error("missing image"));
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = function () {
          try {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d", { willReadFrequently: true });
            const width = Math.max(1, Math.min(32, image.naturalWidth || image.width));
            const height = Math.max(1, Math.min(32, image.naturalHeight || image.height));
            canvas.width = width;
            canvas.height = height;
            context.drawImage(image, 0, 0, width, height);
            const data = context.getImageData(0, 0, width, height).data;
            let red = 0;
            let green = 0;
            let blue = 0;
            let count = 0;
            for (let index = 0; index < data.length; index += 4) {
              if (data[index + 3] < 32) continue;
              red += data[index];
              green += data[index + 1];
              blue += data[index + 2];
              count += 1;
            }
            if (!count) return reject(new Error("empty image"));
            resolve([clampChannel(red / count), clampChannel(green / count), clampChannel(blue / count)]);
          } catch (error) {
            reject(error);
          }
        };
        image.onerror = function () { reject(new Error("image load failed")); };
        image.src = imageUrl;
      });
    }

    function sync() {
      const panel = document.querySelector(".lyrics-panel[data-echo-resource='lyrics']");
      if (!panel) return;
      const fallback = coverThemeColors[panel.dataset.coverTheme || "summer"] || coverThemeColors.summer;
      applyTheme(panel, fallback);
      const coverUrl = panel.dataset.coverUrl || "";
      if (!coverUrl) return;
      const cached = readCached(coverUrl);
      if (cached) applyTheme(panel, cached);
      readDominantColor(coverUrl)
        .then(function (rgb) {
          writeCached(coverUrl, rgb);
          applyTheme(panel, rgb);
        })
        .catch(function () {
          applyTheme(panel, cached || fallback);
        });
    }

    return { sync: sync };
  }

  window.EchoShellLyricsTheme = { create: create };
})();
