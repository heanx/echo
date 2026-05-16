(function () {
  const allowedPattern = /^[A-Za-z0-9@.+\-_!#$%^&*?]+$/;

  function setMatchMessage(message, matched) {
    const output = document.querySelector("[data-password-match-message]");
    if (!output) return;
    output.textContent = message || "";
    output.classList.toggle("hidden", !message);
    output.classList.toggle("text-emerald-600", Boolean(message && matched));
    output.classList.toggle("dark:text-emerald-400", Boolean(message && matched));
    output.classList.toggle("text-rose-500", Boolean(message && !matched));
  }

  function passwordRuleError(value) {
    if (!value) return "";
    if (value.length < 8) return "密码不能低于 8 位";
    if (!/[A-Za-z]/.test(value)) return "密码需要包含英文字母";
    if (!/\d/.test(value)) return "密码需要包含数字";
    if (!allowedPattern.test(value)) return "密码包含暂不支持的字符";
    return "";
  }

  function syncPasswordMatch() {
    const password = document.getElementById("id_password1");
    const confirm = document.getElementById("id_password2");
    if (!password || !confirm) return;

    const ruleError = passwordRuleError(password.value);
    password.setCustomValidity(ruleError);

    if (!confirm.value) {
      setMatchMessage(ruleError, false);
      confirm.setCustomValidity("");
      return;
    }

    if (ruleError) {
      setMatchMessage(ruleError, false);
      confirm.setCustomValidity(ruleError);
      return;
    }

    if (password.value === confirm.value) {
      setMatchMessage("两次输入的密码一致", true);
      confirm.setCustomValidity("");
    } else {
      setMatchMessage("两次输入的密码不一致", false);
      confirm.setCustomValidity("两次输入的密码不一致");
    }
  }

  function setupPasswordToggle(button) {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    button.addEventListener("click", function () {
      const hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      button.setAttribute("aria-pressed", hidden ? "true" : "false");
      button.setAttribute("aria-label", hidden ? "隐藏密码" : "显示密码");
      const showIcon = button.querySelector("[data-password-eye='show']");
      const hideIcon = button.querySelector("[data-password-eye='hide']");
      if (showIcon) showIcon.classList.toggle("hidden", hidden);
      if (hideIcon) hideIcon.classList.toggle("hidden", !hidden);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    const password = document.getElementById("id_password1");
    const confirm = document.getElementById("id_password2");
    if (password && confirm) {
      password.addEventListener("input", syncPasswordMatch);
      confirm.addEventListener("input", syncPasswordMatch);
      syncPasswordMatch();
    }

    document.querySelectorAll("[data-password-toggle]").forEach(setupPasswordToggle);
  });
})();
