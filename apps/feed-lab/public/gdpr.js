(function () {
  var settingsKeys = ['encrypt:feed-lab:settings', 'encrypt:feednt:settings'];
  var colorMode = null;

  try {
    for (var i = 0; i < settingsKeys.length; i += 1) {
      var raw = localStorage.getItem(settingsKeys[i]);
      if (!raw) {
        continue;
      }
      var parsed = JSON.parse(raw);
      if (
        parsed &&
        (parsed.colorMode === 'dark' || parsed.colorMode === 'light')
      ) {
        colorMode = parsed.colorMode;
        break;
      }
    }
  } catch {
    colorMode = null;
  }

  if (colorMode) {
    document.documentElement.setAttribute('data-theme', colorMode);
  }

  function goBackFromGdpr() {
    try {
      var params = new URLSearchParams(window.location.search);
      var returnUrl = params.get('return');
      if (returnUrl) {
        window.location.assign(returnUrl);
        return;
      }
    } catch {
      // Fall through to history or index.html.
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign('./index.html');
  }

  function wireBackButton() {
    var backButton = document.getElementById('gdpr-back-button');
    if (backButton) {
      backButton.addEventListener('click', goBackFromGdpr);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireBackButton);
  } else {
    wireBackButton();
  }
})();
