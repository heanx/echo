// -*- coding: utf-8 -*-
(function () {
  const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
  const outputSize = 512;
  const initialZoom = 1.2;
  let activeDragState = null;

  function extensionOf(file) {
    const parts = String(file && file.name ? file.name : "").split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  }

  function setError(cropper, message) {
    const error = cropper.querySelector("[data-avatar-error]");
    if (!error) return;
    error.textContent = message || "";
    error.classList.toggle("hidden", !message);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function clampOffset(state) {
    const frameSize = state.frame.clientWidth || 160;
    const width = state.image.naturalWidth * state.baseScale * state.zoom;
    const height = state.image.naturalHeight * state.baseScale * state.zoom;
    const minX = Math.min(0, frameSize - width);
    const minY = Math.min(0, frameSize - height);
    const maxX = Math.max(0, frameSize - width);
    const maxY = Math.max(0, frameSize - height);
    state.offsetX = clamp(state.offsetX, minX, maxX);
    state.offsetY = clamp(state.offsetY, minY, maxY);
  }

  function render(state) {
    if (!state.image.naturalWidth || !state.image.naturalHeight) return;
    const frameSize = state.frame.clientWidth || 160;
    const scale = state.baseScale * state.zoom;
    const width = state.image.naturalWidth * scale;
    const height = state.image.naturalHeight * scale;
    clampOffset(state);
    state.image.style.width = width + "px";
    state.image.style.height = height + "px";
    state.image.style.transform = "translate(" + state.offsetX + "px, " + state.offsetY + "px)";
  }

  function moveDrag(state, clientX, clientY) {
    state.offsetX += clientX - state.dragX;
    state.offsetY += clientY - state.dragY;
    state.dragX = clientX;
    state.dragY = clientY;
    render(state);
  }

  function stopDrag() {
    if (!activeDragState) return;
    activeDragState.dragging = false;
    activeDragState.frame.classList.remove("is-dragging");
    activeDragState = null;
  }

  function clearCropper(state) {
    if (state.url) URL.revokeObjectURL(state.url);
    state.url = "";
    state.file = null;
    state.cropper.classList.add("hidden");
    state.image.removeAttribute("src");
    setError(state.cropper, "");
    state.input.value = "";
    if (state.input.form) delete state.input.form.dataset.avatarSubmitting;
  }

  function loadFile(state, file) {
    setError(state.cropper, "");
    if (!file) {
      clearCropper(state);
      return;
    }
    if (!file.type.startsWith("image/") || !allowedExtensions.has(extensionOf(file))) {
      clearCropper(state);
      state.cropper.classList.remove("hidden");
      setError(state.cropper, "只能上传 JPG、PNG 或 WEBP 图片。");
      return;
    }

    if (state.url) URL.revokeObjectURL(state.url);
    state.file = file;
    state.url = URL.createObjectURL(file);
    state.zoom = initialZoom;
    state.offsetX = 0;
    state.offsetY = 0;
    state.zoomInput.value = String(initialZoom);
    state.filename.textContent = file.name;
    state.cropper.classList.remove("hidden");
    if (state.input.form) delete state.input.form.dataset.avatarSubmitting;
    state.image.onload = function () {
      const frameSize = state.frame.clientWidth || 160;
      state.baseScale = Math.max(frameSize / state.image.naturalWidth, frameSize / state.image.naturalHeight);
      const width = state.image.naturalWidth * state.baseScale;
      const height = state.image.naturalHeight * state.baseScale;
      state.offsetX = (frameSize - width) / 2;
      state.offsetY = (frameSize - height) / 2;
      render(state);
    };
    state.image.src = state.url;
  }

  function buildCroppedFile(state) {
    return new Promise(function (resolve) {
      if (!state.file || !state.image.naturalWidth || !window.DataTransfer) {
        resolve(false);
        return;
      }

      const frameSize = state.frame.clientWidth || 160;
      const scale = state.baseScale * state.zoom;
      const sourceX = Math.max(0, -state.offsetX / scale);
      const sourceY = Math.max(0, -state.offsetY / scale);
      const sourceSize = frameSize / scale;
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const context = canvas.getContext("2d");
      context.drawImage(state.image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, outputSize, outputSize);
      canvas.toBlob(function (blob) {
        if (!blob) {
          resolve(false);
          return;
        }
        const cropped = new File([blob], "avatar.jpg", { type: "image/jpeg" });
        const transfer = new DataTransfer();
        transfer.items.add(cropped);
        state.input.files = transfer.files;
        resolve(true);
      }, "image/jpeg", 0.86);
    });
  }

  function setupCropper(cropper) {
    const input = document.getElementById(cropper.dataset.inputId || "");
    if (!input) return null;
    const state = {
      cropper,
      input,
      frame: cropper.querySelector("[data-avatar-frame]"),
      image: cropper.querySelector("[data-avatar-image]"),
      zoomInput: cropper.querySelector("[data-avatar-zoom]"),
      filename: cropper.querySelector("[data-avatar-filename]"),
      clearButton: cropper.querySelector("[data-avatar-clear]"),
      file: null,
      url: "",
      baseScale: 1,
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
      dragging: false,
      dragX: 0,
      dragY: 0,
    };

    input.addEventListener("change", function () {
      loadFile(state, input.files && input.files[0]);
    });
    state.clearButton.addEventListener("click", function () {
      clearCropper(state);
    });
    state.zoomInput.addEventListener("input", function () {
      state.zoom = Number(state.zoomInput.value) || 1;
      render(state);
    });
    state.frame.addEventListener("pointerdown", function (event) {
      if (!state.file) return;
      event.preventDefault();
      event.stopPropagation();
      state.dragging = true;
      state.dragX = event.clientX;
      state.dragY = event.clientY;
      activeDragState = state;
      state.frame.classList.add("is-dragging");
      if (state.frame.setPointerCapture) state.frame.setPointerCapture(event.pointerId);
    });
    state.frame.addEventListener("pointercancel", function () {
      stopDrag();
    });
    return state;
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-avatar-form]").forEach(function (form) {
      const states = Array.from(form.querySelectorAll("[data-avatar-cropper]"))
        .map(setupCropper)
        .filter(Boolean);
      form.addEventListener("submit", function (event) {
        const pending = states.filter(function (state) { return state.file; });
        if (!pending.length || form.dataset.avatarSubmitting === "true") return;
        event.preventDefault();
        Promise.all(pending.map(buildCroppedFile)).then(function () {
          form.dataset.avatarSubmitting = "true";
          form.requestSubmit();
        });
      });
    });
  });
  document.addEventListener("pointermove", function (event) {
    if (!activeDragState || !activeDragState.dragging) return;
    event.preventDefault();
    moveDrag(activeDragState, event.clientX, event.clientY);
  }, { passive: false });
  document.addEventListener("pointerup", function (event) {
    if (!activeDragState) return;
    event.preventDefault();
    stopDrag();
  }, { passive: false });
})();
