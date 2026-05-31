(function () {
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
    if (Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0) cookie += "; max-age=" + Math.round(maxAgeSeconds);
    document.cookie = cookie;
  }

  function read(key, fallback) {
    var stored = "";
    try {
      stored = localStorage.getItem(key) || "";
    } catch (_error) {}
    if (stored) return stored;
    var cookieValue = getCookie(key);
    return cookieValue || fallback;
  }

  function write(key, value, maxAgeSeconds) {
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

  window.EchoShellPersist = { read: read, write: write };
})();
