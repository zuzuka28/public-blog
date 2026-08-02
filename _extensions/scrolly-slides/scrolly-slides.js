(() => {
  "use strict";

  const ROOT_SELECTOR = ".scrolly-slides";
  const STEP_SELECTOR = ".scrolly-slides__step";
  const REVEAL_NAMESPACE = "reveal";
  const REVEAL_EVENTS = new Set([
    "ready",
    "slidechanged",
    "fragmentshown",
    "fragmenthidden",
  ]);
  const ACTIVATION_LINE = 0.38;

  const parseMessage = (data) => {
    if (typeof data === "object" && data !== null) return data;
    if (typeof data !== "string") return null;
    try {
      return JSON.parse(data);
    } catch (_error) {
      return null;
    }
  };

  const parseCoordinates = (value, fallback) => {
    const parts = String(value ?? fallback)
      .trim()
      .split(/[\/.]/)
      .map((part) => Number.parseInt(part, 10));

    return {
      h: Number.isFinite(parts[0]) ? parts[0] : fallback,
      v: Number.isFinite(parts[1]) ? parts[1] : 0,
      f: Number.isFinite(parts[2]) ? parts[2] : undefined,
    };
  };

  const coordinatesKey = ({ h, v, f }) => `${h}/${v}/${f ?? ""}`;
  const slideKey = ({ h, v }) => `${h}/${v}`;

  class ScrollySlides {
    constructor(root) {
      this.root = root;
      this.stage = root.querySelector(".scrolly-slides__stage");
      this.frame = root.querySelector(".scrolly-slides__frame");
      this.steps = Array.from(root.querySelectorAll(STEP_SELECTOR));
      this.progress = root.querySelector(".scrolly-slides__progress span");
      this.count = root.querySelector(".scrolly-slides__count");
      this.previousButton = root.querySelector('[data-scrolly-slides-action="prev"]');
      this.nextButton = root.querySelector('[data-scrolly-slides-action="next"]');
      this.hideButton = root.querySelector('[data-scrolly-slides-action="hide"]');
      this.showButton = root.querySelector('[data-scrolly-slides-action="show"]');
      this.coordinates = this.steps.map((step, index) =>
        parseCoordinates(step.dataset.scrollySlidesSlide, index),
      );
      this.activeIndex = -1;
      this.pendingArticleNavigation = null;
      this.suppressArticleTrackingUntil = 0;
      this.frameOrigin = this.getFrameOrigin();
      this.targetOrigin = this.frameOrigin === "null" ? "*" : this.frameOrigin;
      this.scrollQueued = false;
      this.deckHidden = root.classList.contains("is-deck-hidden");

      this.bindControls();
      this.frame.addEventListener("load", () => {
        this.navigateTo(this.coordinates[Math.max(this.activeIndex, 0)], "article");
      });

      this.setActive(0, "initial");
      this.setDeckHidden(this.deckHidden, false);
      this.updateFloatingVisibility();
    }

    getFrameOrigin() {
      try {
        return new URL(this.frame.src, document.baseURI).origin;
      } catch (_error) {
        return window.location.origin;
      }
    }

    bindControls() {
      this.previousButton?.addEventListener("click", () => this.callReveal("prev"));
      this.nextButton?.addEventListener("click", () => this.callReveal("next"));
      this.hideButton?.addEventListener("click", () => this.setDeckHidden(true));
      this.showButton?.addEventListener("click", () => this.setDeckHidden(false));
    }

    setDeckHidden(hidden, moveFocus = true) {
      if (this.root.dataset.scrollySlidesCollapsible !== "true" && hidden) return;
      this.deckHidden = hidden;
      this.root.classList.toggle("is-deck-hidden", hidden);
      this.root.dataset.scrollySlidesHidden = String(hidden);
      if (this.stage) {
        this.stage.hidden = hidden;
        this.stage.setAttribute("aria-hidden", String(hidden));
      }
      this.hideButton?.setAttribute("aria-expanded", String(!hidden));
      this.showButton?.setAttribute("aria-expanded", String(!hidden));
      this.updateFloatingVisibility();

      if (hidden) {
        if (moveFocus) this.showButton?.focus({ preventScroll: true });
        return;
      }

      window.requestAnimationFrame(() => {
        this.callReveal("layout");
        this.navigateTo(this.coordinates[Math.max(this.activeIndex, 0)], "article");
        if (moveFocus) this.hideButton?.focus({ preventScroll: true });
      });
    }

    callReveal(method, args = []) {
      if (!this.frame?.contentWindow) return;
      this.frame.contentWindow.postMessage(
        JSON.stringify({ method, args }),
        this.targetOrigin,
      );
    }

    navigateTo(coordinates, source) {
      if (!coordinates || this.deckHidden) return;
      if (source === "article") {
        this.pendingArticleNavigation = slideKey(coordinates);
      }
      this.callReveal("slide", [coordinates.h, coordinates.v, coordinates.f]);
    }

    setActive(index, source) {
      if (index < 0 || index >= this.steps.length) return;

      const changed = index !== this.activeIndex;
      this.activeIndex = index;
      this.steps.forEach((step, stepIndex) => {
        const active = stepIndex === index;
        step.classList.toggle("is-active", active);
        if (active) {
          step.setAttribute("aria-current", "step");
        } else {
          step.removeAttribute("aria-current");
        }
      });

      const humanIndex = index + 1;
      if (this.count) this.count.textContent = `${humanIndex} / ${this.steps.length}`;
      if (this.progress) {
        this.progress.style.width = `${(humanIndex / this.steps.length) * 100}%`;
      }
      if (changed && source === "article") {
        this.navigateTo(this.coordinates[index], "article");
      }
    }

    nearestStepIndex() {
      const line = window.innerHeight * ACTIVATION_LINE;
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;

      this.steps.forEach((step, index) => {
        const rect = step.getBoundingClientRect();
        const distance = Math.abs(rect.top - line);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      });
      return bestIndex;
    }

    onScroll() {
      if (this.scrollQueued) return;
      this.scrollQueued = true;
      window.requestAnimationFrame(() => {
        this.scrollQueued = false;
        this.updateFloatingVisibility();
        if (performance.now() < this.suppressArticleTrackingUntil) return;
        this.setActive(this.nearestStepIndex(), "article");
      });
    }

    updateFloatingVisibility() {
      if (this.root.dataset.scrollySlidesMode !== "floating") return;
      if (this.deckHidden) {
        this.root.classList.remove("is-in-view");
        return;
      }
      const rect = this.root.getBoundingClientRect();
      const visible = rect.bottom > window.innerHeight * 0.2 && rect.top < window.innerHeight * 0.8;
      this.root.classList.toggle("is-in-view", visible);
    }

    acceptsMessage(event) {
      if (event.source !== this.frame?.contentWindow) return false;
      return this.frameOrigin === "null" || event.origin === this.frameOrigin;
    }

    handleRevealMessage(event, message) {
      if (!this.acceptsMessage(event)) return;
      if (message?.namespace !== REVEAL_NAMESPACE) return;
      if (!REVEAL_EVENTS.has(message.eventName)) return;

      const state = message.state;
      if (!state || !Number.isFinite(state.indexh)) return;
      const incoming = { h: state.indexh, v: state.indexv ?? 0, f: state.indexf };
      const incomingSlideKey = slideKey(incoming);
      const exactKey = coordinatesKey(incoming);
      let index = this.coordinates.findIndex((coordinates) => coordinatesKey(coordinates) === exactKey);
      if (index < 0) {
        index = this.coordinates.findIndex((coordinates) => slideKey(coordinates) === incomingSlideKey);
      }
      if (index < 0) return;

      const cameFromArticle = this.pendingArticleNavigation === incomingSlideKey;
      this.pendingArticleNavigation = null;
      this.setActive(index, "deck");
      if (cameFromArticle || message.eventName === "ready") return;

      const step = this.steps[index];
      const desiredTop = window.innerHeight * 0.24;
      const currentTop = step.getBoundingClientRect().top;
      if (Math.abs(currentTop - desiredTop) < 32) return;

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.suppressArticleTrackingUntil = performance.now() + (reduceMotion ? 80 : 850);
      window.scrollTo({
        top: window.scrollY + currentTop - desiredTop,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    }
  }

  const instances = Array.from(document.querySelectorAll(ROOT_SELECTOR)).map(
    (root) => new ScrollySlides(root),
  );

  if (instances.length === 0) return;

  const onScroll = () => instances.forEach((instance) => instance.onScroll());
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  window.addEventListener("message", (event) => {
    const message = parseMessage(event.data);
    if (!message) return;
    instances.forEach((instance) => instance.handleRevealMessage(event, message));
  });

  onScroll();
})();
