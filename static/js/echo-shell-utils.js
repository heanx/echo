(function () {
  function formatTime(value) {
    if (!Number.isFinite(value)) return "--:--";
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60).toString().padStart(2, "0");
    return minutes + ":" + seconds;
  }

  function repeatModeLabel(mode) {
    if (mode === "off") return "顺序播放";
    if (mode === "one") return "单曲循环";
    return "列表循环";
  }

  function normalizeRepeatMode(mode) {
    return mode === "one" || mode === "off" || mode === "all" ? mode : "all";
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
    if (!name || name === "sidebar-playlist") return "默认播放队列";
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

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  window.EchoShellUtils = {
    clampNumber: clampNumber,
    formatTime: formatTime,
    normalizeRepeatMode: normalizeRepeatMode,
    normalizeTrack: normalizeTrack,
    queueDisplayName: queueDisplayName,
    queueIndexForTrack: queueIndexForTrack,
    repeatModeLabel: repeatModeLabel,
  };
})();
