(function () {
  const defaultAllowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);
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

  function findInputClearButton(input) {
    return Array.from(document.querySelectorAll("[data-avatar-input-clear]")).find(function (button) {
      return button.dataset.avatarInputClear === input.id;
    }) || null;
  }

  function presetGroupForInput(input) {
    return Array.from(document.querySelectorAll("[data-avatar-presets]")).find(function (group) {
      return group.dataset.inputId === input.id;
    }) || null;
  }

  function setPreset(group, value) {
    if (!group) return;
    const hidden = group.closest(".block").querySelector("input[name='avatar_preset']");
    if (hidden) hidden.value = value || "";
    group.querySelectorAll("[data-avatar-preset]").forEach(function (button) {
      button.classList.toggle("is-selected", button.dataset.avatarPreset === value);
    });
  }

  function setInputClearVisible(state, visible) {
    if (!state.inputClearButton) return;
    state.inputClearButton.classList.toggle("hidden", !visible);
    state.inputClearButton.classList.toggle("grid", visible);
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
  function prepareImageLayer(state) {
    state.image.classList.remove("hidden");
    state.image.style.display = "block";
  }
  function resetImagePosition(state) {
    if (!state.image.naturalWidth || !state.image.naturalHeight) return;
    const frameSize = state.frame.clientWidth || 160;
    state.baseScale = Math.max(frameSize / state.image.naturalWidth, frameSize / state.image.naturalHeight);
    const width = state.image.naturalWidth * state.baseScale;
    const height = state.image.naturalHeight * state.baseScale;
    state.zoom = initialZoom;
    state.offsetX = (frameSize - width * state.zoom) / 2;
    state.offsetY = (frameSize - height * state.zoom) / 2;
    state.zoomInput.value = String(initialZoom);
    render(state);
  }

  function moveDrag(state, clientX, clientY) {
    state.offsetX += clientX - state.dragX;
    state.offsetY += clientY - state.dragY;
    state.dragX = clientX;
    state.dragY = clientY;
    render(state);
  }

  function zoomBounds(state) {
    return {
      min: Number(state.zoomInput.min) || 1,
      max: Number(state.zoomInput.max) || 3,
    };
  }

  function setZoom(state, nextZoom, originX, originY) {
    if (!state.image.naturalWidth || !state.image.naturalHeight) return;
    const bounds = zoomBounds(state);
    const previousZoom = state.zoom;
    const zoom = clamp(nextZoom, bounds.min, bounds.max);
    if (zoom === previousZoom) return;

    const oldScale = state.baseScale * previousZoom;
    const newScale = state.baseScale * zoom;
    const imageX = (originX - state.offsetX) / oldScale;
    const imageY = (originY - state.offsetY) / oldScale;

    state.zoom = zoom;
    state.offsetX = originX - imageX * newScale;
    state.offsetY = originY - imageY * newScale;
    state.zoomInput.value = String(zoom);
    render(state);
  }

  function stopDrag() {
    if (!activeDragState) return;
    activeDragState.dragging = false;
    activeDragState.frame.classList.remove("is-dragging");
    activeDragState = null;
  }

  function clearCropper(state, keepPreset) {
    if (state.url) URL.revokeObjectURL(state.url);
    state.url = "";
    state.file = null;
    state.cropper.classList.add("hidden");
    state.cropper.classList.remove("is-preset-preview");
    state.image.classList.add("hidden");
    state.image.removeAttribute("src");
    state.image.removeAttribute("style");
    state.zoomInput.disabled = false;
    setError(state.cropper, "");
    state.input.value = "";
    if (!keepPreset) setPreset(presetGroupForInput(state.input), "");
    setInputClearVisible(state, false);
    if (state.input.form) delete state.input.form.dataset.avatarSubmitting;
  }

  function showStaticPreview(state, src, label, cropEnabled) {
    if (!src) return;
    if (state.url) URL.revokeObjectURL(state.url);
    state.url = "";
    state.file = cropEnabled ? { name: "current-avatar.jpg" } : null;
    state.input.value = "";
    state.zoom = cropEnabled ? initialZoom : 1;
    state.offsetX = 0;
    state.offsetY = 0;
    state.zoomInput.value = String(state.zoom);
    state.zoomInput.disabled = !cropEnabled;
    state.filename.textContent = label || "当前头像";
    state.cropper.classList.remove("hidden");
    state.cropper.classList.toggle("is-preset-preview", !cropEnabled);
    setInputClearVisible(state, false);
    setError(state.cropper, "");
    state.image.onload = function () {
      prepareImageLayer(state);
      resetImagePosition(state);
    };
    state.image.src = src;
    if (state.input.form) delete state.input.form.dataset.avatarSubmitting;
  }

  function showPresetPreview(state, button) {
    const image = button.querySelector("img");
    if (!image) return;
    showStaticPreview(state, image.src, "系统预设头像");
  }

  function loadFile(state, file) {
    setError(state.cropper, "");
    if (!file) {
      clearCropper(state);
      return;
    }
    if (!file.type.startsWith("image/") || !state.allowedExtensions.has(extensionOf(file))) {
      clearCropper(state);
      state.cropper.classList.remove("hidden");
      setError(state.cropper, "只能上传 " + Array.from(state.allowedExtensions).map(function (ext) { return ext.toUpperCase(); }).join("、") + " 图片。");
      return;
    }

    if (state.url) URL.revokeObjectURL(state.url);
    state.file = file;
    state.cropper.classList.remove("is-preset-preview");
    state.zoomInput.disabled = false;
    state.url = URL.createObjectURL(file);
    state.zoom = initialZoom;
    state.offsetX = 0;
    state.offsetY = 0;
    state.zoomInput.value = String(initialZoom);
    state.filename.textContent = file.name;
    state.cropper.classList.remove("hidden");
    setInputClearVisible(state, true);
    if (state.input.form) delete state.input.form.dataset.avatarSubmitting;
    state.image.onload = function () {
      prepareImageLayer(state);
      resetImagePosition(state);
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
        const cropped = new File([blob], state.outputName || "avatar.jpg", { type: "image/jpeg" });
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
    const externalFrame = cropper.dataset.externalFrameId ? document.getElementById(cropper.dataset.externalFrameId) : null;
    const allowed = cropper.dataset.allowedExtensions
      ? new Set(cropper.dataset.allowedExtensions.split(",").map(function (item) { return item.trim().toLowerCase(); }).filter(Boolean))
      : defaultAllowedExtensions;
    const state = {
      cropper,
      input,
      frame: externalFrame || cropper.querySelector("[data-avatar-frame]"),
      image: (externalFrame || cropper).querySelector("[data-avatar-image]"),
      zoomInput: cropper.querySelector("[data-avatar-zoom]"),
      filename: cropper.querySelector("[data-avatar-filename]"),
      clearButton: cropper.querySelector("[data-avatar-clear]"),
      keepCurrentButton: cropper.querySelector("[data-avatar-keep-current]"),
      cropCurrentButton: cropper.querySelector("[data-avatar-crop-current]"),
      inputClearButton: findInputClearButton(input),
      allowedExtensions: allowed,
      outputName: cropper.dataset.outputName || "avatar.jpg",
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
    if (!state.frame || !state.image || !state.zoomInput || !state.clearButton) return null;

    input.addEventListener("change", function () {
      if (input.files && input.files[0]) setPreset(presetGroupForInput(input), "");
      loadFile(state, input.files && input.files[0]);
    });
    state.clearButton.addEventListener("click", function () {
      clearCropper(state);
    });
    if (state.inputClearButton) {
      state.inputClearButton.addEventListener("click", function () {
        clearCropper(state);
      });
    }
    if (state.keepCurrentButton) {
      state.keepCurrentButton.addEventListener("click", function () {
        clearCropper(state, true);
        setPreset(presetGroupForInput(input), "");
        showStaticPreview(state, cropper.dataset.initialAvatarUrl, "当前头像");
      });
    }
    if (state.cropCurrentButton) {
      state.cropCurrentButton.addEventListener("click", function () {
        clearCropper(state, true);
        setPreset(presetGroupForInput(input), "");
        showStaticPreview(state, cropper.dataset.initialAvatarUrl, "当前头像（裁剪中）", true);
      });
    }
    const presetGroup = presetGroupForInput(input);
    if (presetGroup) {
      const hidden = presetGroup.closest(".block").querySelector("input[name='avatar_preset']");
      if (hidden && hidden.value) setPreset(presetGroup, hidden.value);
      presetGroup.querySelectorAll("[data-avatar-preset]").forEach(function (button) {
        button.addEventListener("click", function () {
          clearCropper(state, true);
          setPreset(presetGroup, button.dataset.avatarPreset);
          showPresetPreview(state, button);
        });
      });
      const selected = hidden && hidden.value ? presetGroup.querySelector("[data-avatar-preset='" + hidden.value + "']") : null;
      if (selected) showPresetPreview(state, selected);
    }
    if (!state.file && cropper.dataset.initialAvatarUrl && !cropper.classList.contains("is-preset-preview")) {
      showStaticPreview(state, cropper.dataset.initialAvatarUrl, "当前头像");
    }
    cropper.addEventListener("avatar-cropper:reset", function () {
      resetImagePosition(state);
      setError(state.cropper, "");
      if (state.input.form) delete state.input.form.dataset.avatarSubmitting;
    });
    state.zoomInput.addEventListener("input", function () {
      const frameSize = state.frame.clientWidth || 160;
      setZoom(state, Number(state.zoomInput.value) || 1, frameSize / 2, frameSize / 2);
    });
    state.zoomInput.addEventListener("wheel", function (event) {
      if (!state.file) return;
      event.preventDefault();
      const frameSize = state.frame.clientWidth || 160;
      const nextZoom = state.zoom * Math.exp(-event.deltaY * 0.0015);
      setZoom(state, nextZoom, frameSize / 2, frameSize / 2);
    });
    state.frame.addEventListener("wheel", function (event) {
      if (!state.file || state.cropper.dataset.cropLocked === "true") return;
      event.preventDefault();
      const rect = state.frame.getBoundingClientRect();
      const originX = event.clientX - rect.left;
      const originY = event.clientY - rect.top;
      const nextZoom = state.zoom * Math.exp(-event.deltaY * 0.0015);
      setZoom(state, nextZoom, originX, originY);
    });
    state.frame.addEventListener("pointerdown", function (event) {
      if (!state.file || state.cropper.dataset.cropLocked === "true") return;
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
