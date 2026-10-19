const API = "/api/v1";
const state = { user: null, contacts: [], touchpoints: [], analytics: null, drafts: [], draft: null, emailAccount: null };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

let sessionExpired = false;
let refreshPromise = null;

function cookie(name) {
  const prefix = `${name}=`;
  const row = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return row ? decodeURIComponent(row.slice(prefix.length)) : "";
}

function errorMessage(data) {
  const detail = data?.error?.detail ?? data?.detail ?? data;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item) => item?.message || String(item)).join(" ");
  if (detail && typeof detail === "object") {
    if (typeof detail.detail === "string") {
      const extra = Array.isArray(detail.messages)
        ? detail.messages.map((item) => item.message).filter(Boolean).join(" ")
        : "";
      return extra ? `${detail.detail} ${extra}` : detail.detail;
    }
    return Object.values(detail).flat().map((item) => item?.message || item).filter((item) => typeof item === "string").join(" ");
  }
  return "";
}

function endSession() {
  sessionExpired = true;
  if (startDueSending.timer) {
    clearInterval(startDueSending.timer);
    startDueSending.timer = null;
  }
  closeModal();
  showAuth();
}

function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API}/auth/refresh/`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-CSRFToken": cookie("csrftoken") },
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function api(path, options = {}, retry = true) {
  if (sessionExpired && retry) throw new Error("Your session expired. Sign in again.");
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD"].includes(options.method || "GET")) headers["X-CSRFToken"] = cookie("csrftoken");
  const response = await fetch(`${API}${path}`, { credentials: "same-origin", ...options, headers });
  if (response.status === 401 && retry) {
    const refreshed = await refreshSession();
    if (refreshed.ok) return api(path, options, false);
    endSession();
    throw new Error("Your session expired. Sign in again.");
  }
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(errorMessage(data) || `Request failed (${response.status})`);
  return data;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function initials(name = "?") {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function friendlyDate(value) {
  if (!value) return "Not yet";
  const date = new Date(value);
  const diff = Math.ceil((date - new Date()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff < 8) return `In ${diff} days`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2800);
}

function showAuth() {
  $("#auth-screen").classList.remove("hidden");
  $("#app-shell").classList.add("hidden");
  resetOtpStep();
}

function showApp() {
  sessionExpired = false;
  $("#auth-screen").classList.add("hidden");
  $("#app-shell").classList.remove("hidden");
  $("#user-name").textContent = state.user.name;
  $("#user-email").textContent = state.user.email;
  $("#user-avatar").textContent = initials(state.user.name);
  $("#page-title").textContent = `Good to see you, ${state.user.name.split(" ")[0]}`;
  $("#today-label").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  startDueSending();
}

async function listAll(path) {
  const items = [];
  let next = path;
  while (next) {
    const page = await api(next);
    items.push(...(page.results || []));
    if (!page.next) break;
    const url = new URL(page.next, location.origin);
    next = `${url.pathname.replace(/^\/api\/v1/, "")}${url.search}`;
  }
  return items;
}

async function loadData() {
  const [analytics, contacts, touchpoints, messages, emailAccount] = await Promise.all([
    api("/analytics/overview/"),
    api("/contacts/?ordering=-created_at"),
    api("/touchpoints/upcoming/?ordering=due_at"),
    listAll("/messages/?ordering=-created_at"),
    api("/users/me/email/"),
  ]);
  state.analytics = analytics;
  state.contacts = contacts.results;
  state.touchpoints = touchpoints.results;
  state.drafts = messages.sort(compareMessages);
  state.emailAccount = emailAccount;
  render();
}

function render() {
  const a = state.analytics;
  const stats = [
    ["People in your circle", a.active_contacts],
    ["Coming up", a.upcoming_touchpoints],
    ["Needs attention", a.overdue_touchpoints],
    ["Connected this month", a.contacted_last_30_days],
  ];
  $("#stats-grid").innerHTML = stats.map(([label, value]) =>
    `<article class="stat"><span>${label}</span><strong>${value}</strong><i></i></article>`
  ).join("");
  $("#hero-copy").textContent = a.overdue_touchpoints
    ? `${a.overdue_touchpoints} ${a.overdue_touchpoints === 1 ? "person needs" : "people need"} a little attention today.`
    : "You're all caught up. A great moment to send an unexpected hello.";

  $("#upcoming-list").innerHTML = state.touchpoints.slice(0, 4).map(touchpointRow).join("") ||
    `<div class="empty">No touchpoints yet. Add a schedule to someone.</div>`;
  $("#recent-contacts").innerHTML = state.contacts.slice(0, 4).map(contactCard).join("") ||
    `<div class="empty">Your circle is waiting.</div>`;
  renderContacts(state.contacts);
  $("#touchpoints-list").innerHTML = state.touchpoints.map((item) => {
    const contact = state.contacts.find((person) => person.id === item.contact_id);
    return `<article class="timeline-row">
      <span class="date-chip">${friendlyDate(item.due_at)}</span>
      <div><h3>${escapeHTML(contact?.name || "Contact")}</h3><p>${escapeHTML(touchpointWhy(item))}</p></div>
      <div class="draft-actions">
        <button class="button secondary" type="button" data-edit-schedule="${item.id}">Edit time</button>
        <button class="button secondary" type="button" data-draft-contact="${item.contact_id}">Draft message</button>
        <button class="text-button danger" type="button" data-delete-touchpoint="${item.id}">Delete</button>
      </div>
    </article>`;
  }).join("") || `<div class="empty">Nothing scheduled yet.</div>`;
  renderDrafts();
  fillEmailForm();
}

function fillEmailForm() {
  const account = state.emailAccount;
  if (!account) return;
  const form = $("#email-form");
  form.elements.from_email.value = account.from_email || "";
  form.elements.host.value = account.host || "";
  form.elements.port.value = account.port || 587;
  form.elements.username.value = account.username || "";
  form.elements.security.value = account.security || "tls";
  form.elements.password.value = "";
  form.elements.password.placeholder = account.password_set ? "Saved — leave blank to keep it" : "App password";
}

const purposeLabels = {
  check_in: "Check in",
  reconnect: "Reconnect",
  birthday: "Birthday",
  congratulations: "Congratulations",
  gratitude: "Gratitude",
  custom: "Custom",
};

const messageRank = { queued: 0, approved: 1, draft: 2, failed: 3, sent: 4, delivered: 4, cancelled: 5 };

function compareMessages(left, right) {
  const rank = (messageRank[left.status] ?? 6) - (messageRank[right.status] ?? 6);
  if (rank) return rank;
  const leftTime = left.scheduled_for || left.created_at;
  const rightTime = right.scheduled_for || right.created_at;
  if (left.status === "approved" || left.status === "queued") {
    return new Date(leftTime) - new Date(rightTime);
  }
  return new Date(rightTime) - new Date(leftTime);
}

function messageStatusLine(item) {
  const purpose = purposeLabels[item.purpose] || item.purpose;
  const channel = channelLabels[item.channel] || "";
  const via = channel ? ` · ${channel}` : "";
  if (item.status === "approved" && item.scheduled_for) {
    return `${purpose} · Approved${via} · notifies you ${scheduleLabel(item.scheduled_for)}`;
  }
  if (item.status === "queued") return `${purpose} · Overdue${via} · not sent yet`;
  if (item.status === "sent" || item.status === "delivered") return `${purpose} · Sent${via}`;
  if (item.status === "failed") return `${purpose} · Could not be prepared`;
  if (item.status === "cancelled") return `${purpose} · Cancelled`;
  return `${purpose} · Draft`;
}

function draftActions(item) {
  const buttons = [];
  if (item.status === "queued" || item.status === "approved") {
    buttons.push(`<button class="button secondary" type="button" data-view-message="${item.id}">${item.status === "queued" ? "Open" : "View"}</button>`);
  }
  if (["draft", "approved", "failed"].includes(item.status)) {
    buttons.push(`<button class="button secondary" type="button" data-edit-draft="${item.id}">Edit</button>`);
  }
  buttons.push(`<button class="text-button danger" type="button" data-delete-draft="${item.id}">Delete</button>`);
  return buttons.join("");
}

function messageBucket(item) {
  if (["sent", "delivered", "cancelled"].includes(item.status)) return "sent";
  const when = item.scheduled_for ? new Date(item.scheduled_for) : null;
  if (item.status === "queued" || item.status === "failed" || (when && when.getTime() <= Date.now())) return "overdue";
  return "scheduled";
}

function messageTime(item) {
  return new Date(item.scheduled_for || item.updated_at || item.created_at);
}

function draftRow(item) {
  const person = state.contacts.find((contact) => contact.id === item.contact);
  const when = item.scheduled_for || item.created_at;
  return `<article class="timeline-row">
    <span class="date-chip">${friendlyDate(when)}</span>
    <div>
      <h3>${escapeHTML(person?.name || "Contact")}</h3>
      <p>${escapeHTML(messageStatusLine(item))}</p>
      <p class="draft-preview">${escapeHTML(item.body)}</p>
    </div>
    <div class="draft-actions">${draftActions(item)}</div>
  </article>`;
}

function draftSection(title, items) {
  const rows = items.map(draftRow).join("") || `<div class="empty">Nothing in ${title.toLowerCase()}.</div>`;
  return `<section class="draft-section"><h3>${title} <span>${items.length}</span></h3><div class="timeline-list">${rows}</div></section>`;
}

function renderDrafts() {
  const term = $("#draft-search")?.value || "";
  const visible = state.drafts.filter((item) => {
    if (!term.trim()) return true;
    const person = state.contacts.find((contact) => contact.id === item.contact);
    return person ? personHaystack(person).includes(term.trim().toLowerCase()) : false;
  });
  if (!state.drafts.length) {
    $("#drafts-list").innerHTML = `<div class="empty">No drafts or scheduled messages yet. Generate a message and it stays here after you approve it.</div>`;
    return;
  }
  const overdue = visible.filter((item) => messageBucket(item) === "overdue").sort((a, b) => messageTime(a) - messageTime(b));
  const scheduled = visible.filter((item) => messageBucket(item) === "scheduled").sort((a, b) => messageTime(a) - messageTime(b));
  const sent = visible.filter((item) => messageBucket(item) === "sent").sort((a, b) => messageTime(b) - messageTime(a));
  $("#drafts-list").innerHTML = [
    draftSection("Overdue", overdue),
    draftSection("Scheduled", scheduled),
    draftSection("Sent", sent),
  ].join("");
}

function touchpointWhy(item) {
  const reasons = (item.reasons || []).map((text) => String(text).trim()).filter(Boolean);
  if (!reasons.length) return `${item.status} · scheduled check-in`;
  return `${item.status} · Why: ${reasons.join(", ")}`;
}

function touchpointRow(item) {
  const contact = state.contacts.find((person) => person.id === item.contact_id);
  const name = contact?.name || "Contact";
  const reasons = (item.reasons || []).map((text) => String(text).trim()).filter(Boolean);
  const detail = reasons.length ? `Why: ${reasons.join(", ")}` : (contact?.relationship || "relationship");
  return `<div class="list-item">
    <span class="avatar">${initials(name)}</span>
    <div><strong>${escapeHTML(name)}</strong><small>${escapeHTML(detail)}</small></div>
    <span class="date-chip">${friendlyDate(item.due_at)}</span>
  </div>`;
}

function contactCard(person) {
  return `<article class="contact-card">
    <button data-contact="${person.id}">
      <span class="avatar">${initials(person.name)}</span>
      <h3>${escapeHTML(person.name)}</h3>
      <p>${escapeHTML(person.relationship)}</p>
      <footer><span>${escapeHTML(person.preferred_channel || "No channel")}</span><span>${friendlyDate(person.last_contacted_at)}</span></footer>
    </button>
    <div class="card-actions">
      <button class="text-button" type="button" data-edit-contact="${person.id}">Edit</button>
      <button class="text-button danger" type="button" data-delete-contact="${person.id}">Delete</button>
    </div>
  </article>`;
}

function personHaystack(person) {
  return [person.name, person.email, person.phone, person.whatsapp, person.telegram, person.messenger, person.relationship]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchingPeople(term) {
  const query = term.trim().toLowerCase();
  if (!query) return state.contacts;
  return state.contacts.filter((person) => personHaystack(person).includes(query));
}

function setDraftPerson(contactId) {
  const person = state.contacts.find((item) => item.id === contactId);
  $("#draft-contact").value = person ? person.id : "";
  $("#draft-contact-search").value = person ? person.name : "";
  const channel = person?.preferred_channel;
  if (channelLabels[channel]) $("#message-channel").value = channel;
  updateChannelHint();
}

function renderPersonResults() {
  const term = $("#draft-contact-search").value;
  const selected = $("#draft-contact").value;
  const matches = matchingPeople(term);
  const list = $("#draft-contact-list");
  list.innerHTML = matches.map((person) => `<button type="button" class="person-option${person.id === selected ? " selected" : ""}" data-pick-person="${person.id}">
    <strong>${escapeHTML(person.name)}</strong>
    <span>${escapeHTML(person.email || person.whatsapp || person.phone || person.telegram || person.messenger || person.relationship || "")}</span>
  </button>`).join("") || `<p class="person-empty">No people found.</p>`;
  list.classList.remove("hidden");
}

function hidePersonResults() {
  $("#draft-contact-list").classList.add("hidden");
}

function renderContacts(contacts) {
  $("#contacts-grid").innerHTML = contacts.map(contactCard).join("") ||
    `<div class="empty">No people found.</div>`;
}

function switchView(name) {
  $$(".view").forEach((view) => view.classList.add("hidden"));
  $(`#${name}-view`).classList.remove("hidden");
  $$(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === name));
  $(".sidebar").classList.remove("open");
}

function localDateTimeValue(value) {
  const date = new Date(value);
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

let editingTouchpointId = null;
let editingRhythm = null;

function openRhythmEditor(button) {
  editingRhythm = {
    scheduleId: button.dataset.editRhythm,
    contactId: button.dataset.rhythmContact,
  };
  $("#rhythm-title").textContent = `Rhythm for ${button.dataset.rhythmName}`;
  $("#rhythm-days").value = button.dataset.rhythmDays || "30";
  openModal("rhythm-modal");
}

$("#rhythm-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const days = Number(new FormData(event.currentTarget).get("days"));
  if (!Number.isInteger(days) || days < 1) {
    toast("Choose at least 1 day.");
    return;
  }
  const rhythm = editingRhythm;
  try {
    await api(`/contacts/${rhythm.contactId}/schedules/${rhythm.scheduleId}/`, {
      method: "PATCH",
      body: JSON.stringify({ mode: "fixed", interval_min_days: days, interval_max_days: days }),
    });
    closeModal();
    toast("Rhythm updated");
    editingRhythm = null;
    await loadData();
    await showContact(rhythm.contactId);
  } catch (error) {
    toast(error.message);
  }
});

function openScheduleEditor(touchpointId) {
  const item = state.touchpoints.find((point) => point.id === touchpointId);
  if (!item) return;
  const person = state.contacts.find((contact) => contact.id === item.contact_id);
  editingTouchpointId = touchpointId;
  $("#schedule-title").textContent = person ? `When to reach ${person.name}` : "Edit schedule";
  $("#schedule-due").min = localDateTimeValue(new Date());
  $("#schedule-due").value = localDateTimeValue(item.due_at);
  openModal("schedule-modal");
}

$("#schedule-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const due = new Date(new FormData(event.currentTarget).get("due_at"));
  if (Number.isNaN(due.getTime()) || due <= new Date()) {
    toast("Choose a future time.");
    return;
  }
  try {
    await api(`/touchpoints/${editingTouchpointId}/reschedule/`, {
      method: "PATCH",
      body: JSON.stringify({ due_at: due.toISOString() }),
    });
    closeModal();
    toast("Schedule updated");
    editingTouchpointId = null;
    await loadData();
  } catch (error) {
    toast(error.message);
  }
});

function openModal(id) {
  $("#modal-backdrop").classList.remove("hidden");
  $$(".modal").forEach((modal) => modal.classList.add("hidden"));
  $(`#${id}`).classList.remove("hidden");
}

function closeModal() {
  $("#modal-backdrop").classList.add("hidden");
  $$(".modal").forEach((modal) => modal.classList.add("hidden"));
}

function memoryChoices(memories, contactId) {
  if (!memories.length) return "<p>No memories yet.</p>";
  const choices = memories.map((item) => `<label class="memory-choice">
    <input type="checkbox" data-memory-toggle="${item.id}" data-memory-contact="${contactId}"${item.allow_drafting ? " checked" : ""}>
    <span>${escapeHTML(item.content)}</span>
  </label>`).join("");
  return `<div class="memory-list">${choices}</div><p class="hint">Select any memories to include in a draft. More than one can be selected.</p>`;
}

async function showContact(id) {
  const person = state.contacts.find((item) => item.id === id);
  if (!person) return;
  openModal("detail-modal");
  $("#contact-detail").innerHTML = `<div class="empty">Loading ${escapeHTML(person.name)}…</div>`;
  try {
    const [memories, interactions, schedules] = await Promise.all([
      api(`/contacts/${id}/memories/`),
      api(`/contacts/${id}/interactions/`),
      api(`/contacts/${id}/schedules/`),
    ]);
    const schedule = schedules.results[0];
    const nextCheckIn = state.touchpoints.find((item) => item.contact_id === id);
    $("#contact-detail").innerHTML = `
      <header class="detail-header">
        <span class="avatar">${initials(person.name)}</span>
        <div><h2>${escapeHTML(person.name)}</h2><span class="muted">${escapeHTML(person.relationship)} · ${escapeHTML(person.email || person.whatsapp || "No contact details")}</span></div>
      </header>
      <div class="detail-tabs">
        <section class="detail-block"><h4>Memories</h4>
          ${memoryChoices(memories.results, id)}
          <form class="quick-form" data-memory-form="${id}"><input name="content" placeholder="Add a useful detail" required><button>＋</button></form>
        </section>
        <section class="detail-block"><h4>Interactions</h4>
          <div>${interactions.results.slice(0, 4).map((item) => `<p>• ${escapeHTML(item.kind)} · ${friendlyDate(item.occurred_at)}</p>`).join("") || "<p>No interactions yet.</p>"}</div>
          <form class="quick-form" data-interaction-form="${id}"><select name="kind"><option value="message">Message</option><option value="call">Call</option><option value="in_person">In person</option></select><button>＋</button></form>
        </section>
        <section class="detail-block"><h4>Outreach rhythm</h4>
          ${schedule ? `<p>Every ${schedule.interval_min_days}${schedule.mode === "randomized" ? `–${schedule.interval_max_days}` : ""} days</p><p>Next: ${friendlyDate(schedule.next_due_at)}</p><div class="rhythm-actions"><button class="button secondary" type="button" data-edit-rhythm="${schedule.id}" data-rhythm-contact="${id}" data-rhythm-days="${schedule.interval_min_days}" data-rhythm-name="${escapeHTML(person.name)}">Edit rhythm</button>${nextCheckIn ? `<button class="button secondary" type="button" data-edit-schedule="${nextCheckIn.id}">Edit time</button>` : ""}</div>` :
          `<p>No schedule yet.</p><form class="quick-form" data-schedule-form="${id}"><input name="days" type="number" min="1" value="30"><button>＋</button></form>`}
        </section>
      </div>
      <div class="button-row">
        <button class="button danger" type="button" data-delete-contact="${id}">Delete</button>
        <button class="button secondary" type="button" data-edit-contact="${id}">Edit</button>
        <button class="button primary" type="button" data-draft-contact="${id}">✦ Draft a message</button>
      </div>`;
  } catch (error) {
    $("#contact-detail").innerHTML = `<div class="empty">${escapeHTML(error.message)}</div>`;
  }
}

let registerMode = false;
let otpChallenge = null;

function setAuthMode() {
  $("#name-field").classList.toggle("hidden", !registerMode);
  $("#email-field").classList.remove("hidden");
  $("#password-field").classList.remove("hidden");
  $("#otp-step").classList.add("hidden");
  $("#auth-otp").required = false;
  $("#auth-email").required = true;
  $("#auth-password").required = true;
  $("#auth-title").textContent = registerMode ? "Create your private space" : "Sign in to your space";
  $("#auth-subtitle").textContent = registerMode ? "Start remembering the people who matter." : "Your relationships are private and always yours.";
  $("#auth-submit-label").textContent = registerMode ? "Create account" : "Sign in";
  $("#auth-switch").textContent = registerMode ? "Already have an account? Sign in" : "New here? Create an account";
  $("#auth-password").autocomplete = registerMode ? "new-password" : "current-password";
}

function resetOtpStep() {
  otpChallenge = null;
  $("#auth-otp").value = "";
  setAuthMode();
}

function showOtpStep(result) {
  otpChallenge = result.challenge_id;
  $("#name-field").classList.add("hidden");
  $("#email-field").classList.add("hidden");
  $("#password-field").classList.add("hidden");
  $("#otp-step").classList.remove("hidden");
  $("#auth-email").required = false;
  $("#auth-password").required = false;
  $("#auth-otp").required = true;
  $("#auth-title").textContent = "Check your email";
  $("#auth-subtitle").textContent = result.detail;
  $("#auth-submit-label").textContent = "Verify code";
  $("#auth-switch").textContent = "Start over";
  $("#otp-hint").textContent = result.debug_code
    ? `This server is not delivering mail yet. Your code is ${result.debug_code}.`
    : "The code expires in 10 minutes.";
  $("#auth-otp").focus();
}

$("#auth-switch").addEventListener("click", () => {
  if (otpChallenge) {
    resetOtpStep();
    return;
  }
  registerMode = !registerMode;
  setAuthMode();
});

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#auth-error").textContent = "";
  try {
    if (otpChallenge) {
      const code = $("#auth-otp").value.trim();
      if (!/^\d{6}$/.test(code)) {
        $("#auth-error").textContent = "Enter the 6-digit code from your email.";
        return;
      }
      state.user = await api("/auth/verify-otp/", {
        method: "POST",
        body: JSON.stringify({ challenge_id: otpChallenge, code }),
      }, false);
      otpChallenge = null;
      showApp();
      await loadData();
      return;
    }
    const form = new FormData(event.currentTarget);
    const body = { email: form.get("email"), password: form.get("password") };
    if (registerMode) Object.assign(body, { name: form.get("name"), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    const result = await api(registerMode ? "/auth/register/" : "/auth/login/", { method: "POST", body: JSON.stringify(body) }, false);
    if (result.otp_required) {
      showOtpStep(result);
      return;
    }
    state.user = result;
    showApp();
    await loadData();
  } catch (error) {
    $("#auth-error").textContent = error.message;
  }
});

$("#logout-button").addEventListener("click", async () => {
  try { await api("/auth/logout/", { method: "POST" }); } catch (_) { /* Always clear UI. */ }
  if (startDueSending.timer) {
    clearInterval(startDueSending.timer);
    startDueSending.timer = null;
  }
  state.user = null;
  sessionExpired = false;
  showAuth();
});

$("#add-contact-button").addEventListener("click", () => openContactForm());
$("#draft-button").addEventListener("click", () => openDraft());
$("#mail-security").addEventListener("change", () => {
  const port = $("#mail-port");
  if ($("#mail-security").value === "ssl" && port.value === "587") port.value = "465";
  if ($("#mail-security").value === "tls" && port.value === "465") port.value = "587";
});
$("#email-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  data.port = Number(data.port);
  if (!data.password) delete data.password;
  try {
    state.emailAccount = await api("/users/me/email/", { method: "PATCH", body: JSON.stringify(data) });
    fillEmailForm();
    toast("Sending email saved");
  } catch (error) { toast(error.message); }
});
$("#email-test").addEventListener("click", async () => {
  try {
    await api("/users/me/email/", { method: "POST", body: "{}" });
    toast("Test email sent to your sending address");
  } catch (error) { toast(error.message); }
});
$("#menu-button").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
$$(".nav-item").forEach((item) => item.addEventListener("click", () => switchView(item.dataset.view)));
$$("[data-go]").forEach((item) => item.addEventListener("click", () => switchView(item.dataset.go)));
$$("[data-close]").forEach((item) => item.addEventListener("click", closeModal));
$("#modal-backdrop").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeModal(); });

$("#contact-search").addEventListener("input", (event) => {
  renderContacts(matchingPeople(event.target.value));
});
$("#draft-search").addEventListener("input", renderDrafts);
$("#draft-contact-search").addEventListener("focus", renderPersonResults);
$("#draft-contact-search").addEventListener("input", () => {
  const person = state.contacts.find((item) => item.id === $("#draft-contact").value);
  if (!person || person.name !== $("#draft-contact-search").value) $("#draft-contact").value = "";
  renderPersonResults();
});

let editingContactId = null;

function openContactForm(person) {
  const form = $("#contact-form");
  form.reset();
  editingContactId = person?.id || null;
  $("#contact-kicker").textContent = person ? "Keep details current" : "Grow your circle";
  $("#contact-title").textContent = person ? "Update this person" : "Add someone important";
  $("#contact-submit").textContent = person ? "Save changes" : "Save person";
  if (person) {
    ["name", "relationship", "preferred_channel", "email", "phone", "whatsapp", "telegram", "messenger", "birthday"].forEach((field) => {
      form.elements[field].value = person[field] || "";
    });
  }
  openModal("contact-modal");
}

$("#contact-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  data.birthday = data.birthday || null;
  if (!editingContactId) {
    Object.keys(data).forEach((key) => { if (!data[key]) delete data[key]; });
  }
  const path = editingContactId ? `/contacts/${editingContactId}/` : "/contacts/";
  const method = editingContactId ? "PATCH" : "POST";
  try {
    await api(path, { method, body: JSON.stringify(data) });
    form.reset();
    closeModal();
    toast(editingContactId ? "Contact updated" : "Person added to your circle");
    editingContactId = null;
    await loadData();
  } catch (error) { toast(error.message); }
});

document.addEventListener("click", async (event) => {
  const pickedPerson = event.target.closest("[data-pick-person]");
  if (pickedPerson) {
    setDraftPerson(pickedPerson.dataset.pickPerson);
    hidePersonResults();
    return;
  }
  if (!event.target.closest(".person-picker")) hidePersonResults();
  const deleteTouchpoint = event.target.closest("[data-delete-touchpoint]");
  if (deleteTouchpoint) {
    event.preventDefault();
    if (deleteTouchpoint.dataset.confirm !== "yes") {
      deleteTouchpoint.dataset.confirm = "yes";
      deleteTouchpoint.textContent = "Confirm delete";
      return;
    }
    try {
      await api(`/touchpoints/${deleteTouchpoint.dataset.deleteTouchpoint}/`, { method: "DELETE" });
      toast("Check-in deleted");
      await loadData();
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  const deleteButton = event.target.closest("[data-delete-contact]");
  if (deleteButton) {
    event.preventDefault();
    const id = deleteButton.dataset.deleteContact;
    const person = state.contacts.find((item) => item.id === id);
    if (!person) return;
    if (deleteButton.dataset.confirm !== "yes") {
      deleteButton.dataset.confirm = "yes";
      deleteButton.textContent = "Confirm delete";
      return;
    }
    try {
      await api(`/contacts/${id}/?permanent=true`, { method: "DELETE" });
      closeModal();
      toast(`${person.name} deleted`);
      await loadData();
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  const editButton = event.target.closest("[data-edit-contact]");
  if (editButton) {
    const person = state.contacts.find((item) => item.id === editButton.dataset.editContact);
    if (person) openContactForm(person);
    return;
  }
  const deleteDraft = event.target.closest("[data-delete-draft]");
  if (deleteDraft) {
    event.preventDefault();
    if (deleteDraft.dataset.confirm !== "yes") {
      deleteDraft.dataset.confirm = "yes";
      deleteDraft.textContent = "Confirm delete";
      return;
    }
    try {
      await api(`/messages/${deleteDraft.dataset.deleteDraft}/`, { method: "DELETE" });
      if (state.draft?.id === deleteDraft.dataset.deleteDraft) state.draft = null;
      toast("Message deleted");
      await loadData();
    } catch (error) { toast(error.message); }
    return;
  }
  const editRhythmButton = event.target.closest("[data-edit-rhythm]");
  if (editRhythmButton) {
    openRhythmEditor(editRhythmButton);
    return;
  }
  const editScheduleButton = event.target.closest("[data-edit-schedule]");
  if (editScheduleButton) {
    openScheduleEditor(editScheduleButton.dataset.editSchedule);
    return;
  }
  const editDraftButton = event.target.closest("[data-edit-draft]");
  if (editDraftButton) {
    const message = state.drafts.find((item) => item.id === editDraftButton.dataset.editDraft);
    if (message) openSavedDraft(message);
    return;
  }
  const viewMessage = event.target.closest("[data-view-message]");
  if (viewMessage) {
    try {
      await openScheduledMessage(viewMessage.dataset.viewMessage);
    } catch (error) { toast(error.message); }
    return;
  }
  const contactButton = event.target.closest("[data-contact]");
  if (contactButton) showContact(contactButton.dataset.contact);
  const draftButton = event.target.closest("[data-draft-contact]");
  if (draftButton) openDraft(draftButton.dataset.draftContact);
});

document.addEventListener("change", async (event) => {
  const memoryToggle = event.target.closest("[data-memory-toggle]");
  if (!memoryToggle) return;
  try {
    await api(`/contacts/${memoryToggle.dataset.memoryContact}/memories/${memoryToggle.dataset.memoryToggle}/`, {
      method: "PATCH",
      body: JSON.stringify({ allow_drafting: memoryToggle.checked }),
    });
  } catch (error) {
    memoryToggle.checked = !memoryToggle.checked;
    toast(error.message);
  }
});

document.addEventListener("submit", async (event) => {
  const memory = event.target.closest("[data-memory-form]");
  const interaction = event.target.closest("[data-interaction-form]");
  const schedule = event.target.closest("[data-schedule-form]");
  if (!memory && !interaction && !schedule) return;
  event.preventDefault();
  try {
    if (memory) {
      const content = new FormData(memory).get("content");
      await api(`/contacts/${memory.dataset.memoryForm}/memories/`, { method: "POST", body: JSON.stringify({ content, allow_drafting: true }) });
      await showContact(memory.dataset.memoryForm);
    }
    if (interaction) {
      const kind = new FormData(interaction).get("kind");
      await api(`/contacts/${interaction.dataset.interactionForm}/interactions/`, {
        method: "POST", body: JSON.stringify({ kind, occurred_at: new Date().toISOString() }),
      });
      await loadData();
      await showContact(interaction.dataset.interactionForm);
    }
    if (schedule) {
      const days = Number(new FormData(schedule).get("days"));
      await api(`/contacts/${schedule.dataset.scheduleForm}/schedules/`, {
        method: "POST", body: JSON.stringify({ mode: "fixed", interval_min_days: days, interval_max_days: days }),
      });
      await loadData();
      await showContact(schedule.dataset.scheduleForm);
    }
    toast("Saved");
  } catch (error) { toast(error.message); }
});

const channelLabels = {
  whatsapp: "WhatsApp",
  email: "Gmail",
  telegram: "Telegram",
  messenger: "Messenger",
};
const openLabels = {
  whatsapp: "Open WhatsApp",
  email: "Open Gmail",
  telegram: "Open Telegram",
  messenger: "Open Messenger",
};

function scheduleLabel(value) {
  return new Date(value).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function renderDueBanner(items) {
  $("#due-sends").innerHTML = (items || []).map((item) => `<article class="due-banner">
    <div><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.body)}</p></div>
    <button class="button primary" type="button" data-open-notice="${item.id}" data-kind="${item.kind || "message"}" data-message-id="${item.message_id || ""}" data-contact-id="${item.contact_id || ""}">Open</button>
  </article>`).join("");
}

async function releaseDueMessages() {
  if (!state.user) return;
  try {
    const result = await api("/messages/dispatch-due/", { method: "POST", body: "{}" });
    renderDueBanner(result.results || []);
  } catch (_) { /* The next check will try again. */ }
}

let sendSheet = null;

async function openScheduledMessage(messageId) {
  const message = state.drafts.find((item) => item.id === messageId);
  await openSendSheet(messageId);
  if (message?.status === "approved" && message.scheduled_for) {
    $("#send-kicker").textContent = "Scheduled";
    $("#send-hint").textContent = `Approved. You'll be notified on ${scheduleLabel(message.scheduled_for)} so you can send it.`;
  }
}

async function openSendSheet(messageId, noticeId) {
  const sheet = await api(`/messages/${messageId}/send-sheet/`);
  sendSheet = sheet;
  $("#send-kicker").textContent = "Ready to send";
  $("#send-title").textContent = `${sheet.channel_label} for ${sheet.contact_name}`;
  $("#send-hint").textContent = sheet.hint;
  $("#send-recipient").textContent = sheet.recipient;
  $("#send-body").textContent = sheet.body;
  $("#send-subject").textContent = sheet.subject || "";
  $("#send-subject-block").classList.toggle("hidden", !sheet.subject);
  const link = $("#send-link");
  link.classList.remove("hidden");
  link.href = sheet.deep_link;
  link.textContent = openLabels[sheet.channel] || "Open";
  link.target = sheet.channel === "email" ? "_self" : "_blank";
  $("#send-hint").textContent = `${sheet.hint} Opening this link marks the message as sent.`;
  openModal("send-modal");
  if (noticeId) {
    api(`/notifications/${noticeId}/open/`, { method: "POST", body: "{}" }).then(() => releaseDueMessages()).catch(() => {});
  }
}

async function copySendText(value, button) {
  let copied = false;
  try {
    await navigator.clipboard.writeText(value);
    copied = true;
  } catch (_) {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    copied = document.execCommand("copy");
    area.remove();
  }
  if (!copied) {
    toast("Select the text and copy it.");
    return;
  }
  const original = button.textContent;
  button.textContent = "Copied";
  setTimeout(() => { button.textContent = original; }, 1200);
}

$("#send-link").addEventListener("click", async (event) => {
  if (!sendSheet?.message_id || !sendSheet.deep_link) return;
  event.preventDefault();
  const sheet = sendSheet;
  try {
    await api(`/messages/${sheet.message_id}/mark-sent/`, { method: "POST", body: "{}" });
  } catch (error) {
    toast(error.message);
    return;
  }
  if (sheet.channel === "email") window.location.href = sheet.deep_link;
  else window.open(sheet.deep_link, "_blank", "noopener");
  closeModal();
  toast("Marked as sent");
  await loadData();
});
$("#copy-recipient").addEventListener("click", () => copySendText(sendSheet?.recipient || "", $("#copy-recipient")));
$("#copy-subject").addEventListener("click", () => copySendText(sendSheet?.subject || "", $("#copy-subject")));
$("#copy-message").addEventListener("click", () => copySendText(sendSheet?.copy_text || "", $("#copy-message")));

function startDueSending() {
  if (startDueSending.timer) return;
  releaseDueMessages();
  startDueSending.timer = setInterval(releaseDueMessages, 10000);
}

document.addEventListener("click", async (event) => {
  const notice = event.target.closest("[data-open-notice]");
  if (!notice) return;
  try {
    if (notice.dataset.kind === "touchpoint") {
      await api(`/notifications/${notice.dataset.openNotice}/open/`, { method: "POST", body: "{}" });
      releaseDueMessages();
      const contactId = notice.dataset.contactId;
      const existing = state.drafts.find((item) => item.contact === contactId && ["draft", "approved", "failed"].includes(item.status));
      if (existing) openSavedDraft(existing);
      else openDraft(contactId);
      return;
    }
    await openSendSheet(notice.dataset.messageId, notice.dataset.openNotice);
  } catch (error) {
    toast(error.message);
  }
});

function setDraftMode(editing) {
  $("#draft-title").textContent = editing ? "Edit draft" : "Draft a personal message";
  $("#draft-submit").textContent = editing ? "✦ Regenerate draft" : "✦ Generate draft";
}

function draftFields() {
  const form = $("#draft-form");
  return {
    contact: form.elements.contact.value,
    purpose: form.elements.purpose.value,
    tone: form.elements.tone.value,
    length: form.elements.length.value,
    custom_instruction: form.elements.custom_instruction.value,
    channel: $("#message-channel").value,
    body: $("#draft-body").value,
  };
}

function openDraft(contactId = "") {
  closeModal();
  openModal("draft-modal");
  $("#draft-form").reset();
  $("#message-channel").value = "whatsapp";
  setDraftPerson(contactId);
  hidePersonResults();
  $("#draft-schedule").classList.add("hidden");
  $("#draft-result").classList.add("hidden");
  $("#delete-open-draft").dataset.confirm = "";
  $("#delete-open-draft").textContent = "Delete";
  state.draft = null;
  setDraftMode(false);
  updateChannelHint();
}

function updateChannelHint() {
  const hints = {
    whatsapp: "You'll get a notification. It opens a page with a WhatsApp link that already contains the message.",
    telegram: "You'll get a notification. It opens a page with a Telegram link that already contains the message.",
    email: "You'll get a notification. The link opens your mail with the recipient and message already filled in. You send it yourself.",
    messenger: "You'll get a notification. Copy the message, then open their Messenger chat and paste it.",
  };
  $("#channel-hint").textContent = hints[$("#message-channel").value] || "";
}

$("#message-channel").addEventListener("change", updateChannelHint);

function openSavedDraft(message) {
  openDraft(message.contact);
  const form = $("#draft-form");
  form.elements.purpose.value = message.purpose;
  form.elements.tone.value = message.tone;
  form.elements.length.value = message.length;
  form.elements.custom_instruction.value = message.custom_instruction || "";
  if (channelLabels[message.channel]) $("#message-channel").value = message.channel;
  updateChannelHint();
  state.draft = message;
  $("#draft-body").value = message.body;
  $("#draft-result").classList.remove("hidden");
  setDraftMode(true);
  if (message.scheduled_for && message.status !== "draft") {
    const note = $("#draft-schedule");
    note.classList.remove("hidden");
    note.textContent = `Scheduled for ${scheduleLabel(message.scheduled_for)}. Save changes updates the text. Approve and schedule sets a new time.`;
  }
}

$("#draft-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!$("#draft-contact").value) {
    toast("Choose a person.");
    renderPersonResults();
    return;
  }
  hidePersonResults();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  delete data.channel;
  delete data.send_in;
  delete data.send_unit;
  try {
    if (state.draft) {
      const fields = draftFields();
      delete fields.body;
      await api(`/messages/${state.draft.id}/`, { method: "PATCH", body: JSON.stringify(fields) });
      state.draft = await api(`/messages/${state.draft.id}/regenerate/`, { method: "POST", body: "{}" });
      toast("Draft updated");
    } else {
      state.draft = await api("/messages/generate/", { method: "POST", body: JSON.stringify(data) });
      toast("Draft ready for your review");
    }
    $("#draft-body").value = state.draft.body;
    $("#draft-result").classList.remove("hidden");
    $("#draft-schedule").classList.add("hidden");
    setDraftMode(true);
    await loadData();
  } catch (error) { toast(error.message); }
});

$("#save-draft").addEventListener("click", async () => {
  if (!state.draft) return;
  try {
    state.draft = await api(`/messages/${state.draft.id}/`, {
      method: "PATCH",
      body: JSON.stringify(draftFields()),
    });
    toast("Message saved");
    await loadData();
  } catch (error) { toast(error.message); }
});

$("#delete-open-draft").addEventListener("click", async () => {
  if (!state.draft) return;
  const button = $("#delete-open-draft");
  if (button.dataset.confirm !== "yes") {
    button.dataset.confirm = "yes";
    button.textContent = "Confirm delete";
    return;
  }
  try {
    await api(`/messages/${state.draft.id}/`, { method: "DELETE" });
    state.draft = null;
    closeModal();
    toast("Message deleted");
    await loadData();
  } catch (error) { toast(error.message); }
});

$("#approve-draft").addEventListener("click", async () => {
  if (!state.draft) return;
  try {
    const channel = $("#message-channel").value;
    const sendIn = Number($("#send-in").value);
    const sendUnit = $("#send-unit").value;
    if (!Number.isInteger(sendIn) || sendIn < 1) {
      toast("Enter a schedule of at least 1 minute.");
      return;
    }
    state.draft = await api(`/messages/${state.draft.id}/`, {
      method: "PATCH",
      body: JSON.stringify({
        ...draftFields(),
        status: "approved",
        channel,
        send_in: sendIn,
        send_unit: sendUnit,
      }),
    });
    const note = $("#draft-schedule");
    const personName = state.contacts.find((item) => item.id === $("#draft-contact").value)?.name || "them";
    note.classList.remove("hidden");
    if (state.draft.status === "failed") {
      note.textContent = "The message could not be prepared.";
      toast(note.textContent);
    } else if (state.draft.status === "queued") {
      note.textContent = `It's time to reach ${personName}. Open the notification at the top of the page.`;
      toast("Your message is ready");
      releaseDueMessages();
    } else {
      note.textContent = `Approved. You'll be notified on ${scheduleLabel(state.draft.scheduled_for)} so you can send it to ${personName}.`;
      toast("Approved and scheduled");
    }
    await loadData();
  } catch (error) { toast(error.message); }
});

(async function boot() {
  try {
    state.user = await api("/users/me/");
    showApp();
    await loadData();
  } catch (_) {
    showAuth();
  }
})();
