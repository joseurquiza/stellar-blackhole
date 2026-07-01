/**
 * Stellar BlackHole embeddable widget loader.
 *
 * Usage (programmatic):
 *   <script src="https://YOUR_DOMAIN/blackhole-widget.js"></script>
 *   <script>
 *     BlackHole.mount('#blackhole', { network: 'public', onComplete: () => {} })
 *   </script>
 *
 * Usage (auto-init via data attributes):
 *   <div id="blackhole"></div>
 *   <script src="https://YOUR_DOMAIN/blackhole-widget.js"
 *           data-blackhole data-target="#blackhole" data-network="public"></script>
 *
 * The widget renders BlackHole's non-custodial cleanup + merge flow in a
 * sandboxed iframe. The end user's Stellar secret key is entered and signed
 * inside that iframe (on the BlackHole origin) and is never exposed to the
 * host page.
 */
;(function () {
  var currentScript = document.currentScript
  // Derive the BlackHole origin from where this script was served.
  var ORIGIN = (function () {
    try {
      return new URL(currentScript.src).origin
    } catch (e) {
      return ""
    }
  })()

  function mount(target, options) {
    options = options || {}
    var el = typeof target === "string" ? document.querySelector(target) : target
    if (!el) {
      console.error("[BlackHole] mount target not found:", target)
      return
    }

    var baseUrl = options.baseUrl || ORIGIN
    var params = new URLSearchParams()
    if (options.network) params.set("network", options.network)
    if (options.theme) params.set("theme", options.theme)

    var iframe = document.createElement("iframe")
    iframe.src = baseUrl + "/embed" + (params.toString() ? "?" + params.toString() : "")
    iframe.setAttribute("title", "Stellar BlackHole")
    iframe.setAttribute("allow", "clipboard-write")
    iframe.style.width = "100%"
    iframe.style.border = "0"
    iframe.style.minHeight = (options.minHeight || 520) + "px"
    iframe.style.height = (options.minHeight || 520) + "px"
    iframe.style.colorScheme = "normal"

    el.innerHTML = ""
    el.appendChild(iframe)

    function onMessage(event) {
      // Only trust messages coming from the BlackHole iframe origin.
      if (baseUrl.indexOf(event.origin) !== 0) return
      var data = event.data
      if (!data || data.source !== "blackhole") return

      switch (data.type) {
        case "resize":
          if (typeof data.height === "number" && data.height > 0) {
            iframe.style.height = data.height + "px"
          }
          break
        case "ready":
          if (typeof options.onReady === "function") options.onReady()
          break
        case "stage":
          if (typeof options.onStage === "function") options.onStage(data.stage)
          break
        case "complete":
          if (typeof options.onComplete === "function") options.onComplete()
          break
      }
    }

    window.addEventListener("message", onMessage)

    return {
      destroy: function () {
        window.removeEventListener("message", onMessage)
        el.innerHTML = ""
      },
    }
  }

  window.BlackHole = { mount: mount }

  // Auto-init when the script tag carries data-blackhole.
  if (currentScript && currentScript.hasAttribute("data-blackhole")) {
    var target = currentScript.getAttribute("data-target") || "#blackhole"
    mount(target, {
      network: currentScript.getAttribute("data-network") || undefined,
      theme: currentScript.getAttribute("data-theme") || undefined,
    })
  }
})()
