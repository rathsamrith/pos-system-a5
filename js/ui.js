// Shared UI primitives: modal (native <dialog>), confirm, toast, icons.
import { html, on } from "./utils.js";

export const icon = (name, extra = "") => html`<span class="icon ${extra}" aria-hidden="true">${name}</span>`;

/**
 * Open a modal. `render(body)` fills it and may return a cleanup fn.
 * Returns { close, el }. Close with Esc, the × button, or any [data-close].
 */
export function openModal({ title, size = "md", render, onClose }) {
  const dialog = document.createElement("dialog");
  dialog.className = `modal modal-${size}`;
  dialog.innerHTML = String(html`
    <header class="modal-head">
      <h2>${title}</h2>
      <button class="btn-icon" data-close aria-label="Close">${icon("close")}</button>
    </header>
    <div class="modal-body"></div>
  `);
  document.body.appendChild(dialog);

  let cleanup;
  const close = () => {
    if (!dialog.isConnected) return;
    cleanup?.();
    dialog.close();
    dialog.remove();
    onClose?.();
  };
  on(dialog, "click", "[data-close]", close);
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  // Click on the backdrop closes.
  dialog.addEventListener("mousedown", (e) => {
    if (e.target === dialog) close();
  });

  dialog.showModal();
  cleanup = render(dialog.querySelector(".modal-body"), close);
  return { close, el: dialog };
}

export function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title,
      size: "sm",
      onClose: () => !answered && resolve(false),
      render(body, close) {
        body.innerHTML = String(html`
          <p class="muted">${message}</p>
          <div class="modal-actions">
            <button class="btn btn-ghost" data-close>Cancel</button>
            <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-ok>${confirmLabel}</button>
          </div>
        `);
        body.querySelector("[data-ok]").addEventListener("click", () => {
          answered = true;
          resolve(true);
          close();
        });
        body.querySelector("[data-ok]").focus();
      },
    });
  });
}

let toastRoot;
export function toast(message, type = "info") {
  if (!toastRoot) {
    toastRoot = document.createElement("div");
    toastRoot.className = "toasts";
    toastRoot.setAttribute("role", "status");
    toastRoot.setAttribute("aria-live", "polite");
    document.body.appendChild(toastRoot);
  }
  const icons = { info: "info", success: "check_circle", error: "error" };
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = String(html`${icon(icons[type] || "info")}<span>${message}</span>`);
  toastRoot.appendChild(el);
  setTimeout(() => {
    el.classList.add("leaving");
    setTimeout(() => el.remove(), 250);
  }, 2600);
}

/** Read a <form> into a plain object (FormData → entries). */
export const formValues = (form) => Object.fromEntries(new FormData(form).entries());

export function emptyState(iconName, title, hint = "", action = "") {
  return html`
    <div class="empty">
      ${icon(iconName, "empty-icon")}
      <p class="empty-title">${title}</p>
      ${hint && html`<p class="muted">${hint}</p>`}
      ${action}
    </div>
  `;
}
