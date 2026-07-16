const state = {
  mode: "mock",
  status: null,
  listings: [],
  leads: [],
  selectedLeadId: null,
  marketing: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`);
  return payload;
}

function loadingMarkup(message) {
  return `<div class="loading-state" aria-live="polite"><div><div class="loader" aria-hidden="true"></div><p>${escapeHtml(message)}</p></div></div>`;
}

function errorMarkup(error) {
  return `<div class="error-state" role="alert"><strong>Unable to complete this request.</strong><br>${escapeHtml(error.message)}</div>`;
}

function setButtonLoading(button, loading, label) {
  if (loading) {
    button.dataset.original = button.innerHTML;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.querySelector("span").textContent = label;
  } else {
    button.disabled = false;
    button.removeAttribute("aria-busy");
    if (button.dataset.original) button.innerHTML = button.dataset.original;
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => { toast.hidden = true; }, 2600);
}

function listingById(id) {
  return state.listings.find((listing) => listing.id === id);
}

function leadById(id) {
  return state.leads.find((lead) => lead.id === id);
}

function updateMode(mode) {
  if (mode === "live" && !state.status?.gpt.configured) {
    showToast("Configure GPT credentials on the server to use Live Foundry.");
    return;
  }
  state.mode = mode;
  $$(".mode-option").forEach((button) => button.classList.toggle("is-active", button.dataset.mode === mode));
  $("#status-label").textContent = mode === "live" ? "Live Foundry" : "Mock data";
  $(".status-dot").style.background = mode === "live" ? "var(--success)" : "var(--gold)";
  updateImageButton();
}

function renderStatus() {
  const { status } = state;
  const authLabel = status.gpt.authMode === "entra" ? "Entra ID" : "API key";
  $("#gpt-status").textContent = status.gpt.configured ? `${status.gpt.deployment} · ${authLabel}` : "Not configured";
  const maiAuthLabel = status.mai.authMode === "entra" ? "Entra ID" : "API key";
  $("#mai-status").textContent = status.mai.configured ? `${status.mai.model} · ${maiAuthLabel}` : "Not configured";
  $("#gpt-dot").classList.toggle("ready", status.gpt.configured);
  $("#mai-dot").classList.toggle("ready", status.mai.configured);
  $('[data-mode="live"]').disabled = !status.gpt.configured;
  updateMode(status.defaultMode);
}

function renderGptAuthMode() {
  const entra = $("#gpt-auth-mode").value === "entra";
  $("#gpt-api-key-field").classList.toggle("is-hidden", entra);
  $("#gpt-api-key-field input").disabled = entra;
  $("#gpt-auth-help").textContent = entra
    ? "Uses DefaultAzureCredential: your Azure CLI sign-in locally, or managed identity when hosted in Azure. The identity needs the Cognitive Services OpenAI User role."
    : "The API key is stored only in the server’s ignored .env file.";
}

function renderMaiAuthMode() {
  const entra = $("#mai-auth-mode").value === "entra";
  $("#mai-api-key-field").classList.toggle("is-hidden", entra);
  $("#mai-api-key-field input").disabled = entra;
  $("#mai-auth-help").textContent = entra
    ? "Uses the same Azure CLI sign-in or managed identity as GPT. The identity needs the Foundry User role."
    : "The API key is stored only in the server’s ignored .env file.";
}

async function openSettings() {
  const dialog = $("#settings-dialog");
  $("#status-popover").hidden = true;
  $("#status-button").setAttribute("aria-expanded", "false");
  $("#settings-error").hidden = true;

  try {
    const settings = await api("/api/settings");
    const form = $("#settings-form");
    form.elements.defaultMode.value = settings.defaultMode;
    form.elements.gptEndpoint.value = settings.gpt.endpoint;
    form.elements.gptIdentifier.value = settings.gpt.identifier;
    form.elements.gptAuthMode.value = settings.gpt.authMode;
    form.elements.gptApiKey.value = "";
    form.elements.maiEndpoint.value = settings.mai.endpoint;
    form.elements.maiIdentifier.value = settings.mai.identifier;
    form.elements.maiAuthMode.value = settings.mai.authMode;
    form.elements.maiApiKey.value = "";
    $("#gpt-key-hint").textContent = settings.gpt.hasApiKey ? "A key is saved; leave blank to keep it" : "No key saved";
    $("#mai-key-hint").textContent = settings.mai.hasApiKey ? "A key is saved; leave blank to keep it" : "No key saved";
    renderGptAuthMode();
    renderMaiAuthMode();
    dialog.showModal();
  } catch (error) {
    showToast(error.message);
  }
}

function closeSettings() {
  $("#settings-dialog").close();
}

async function saveSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const data = Object.fromEntries(new FormData(form));
  const errorBox = $("#settings-error");
  errorBox.hidden = true;
  setButtonLoading(button, true, "Saving securely…");

  try {
    state.status = await api("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        defaultMode: data.defaultMode,
        gpt: {
          endpoint: data.gptEndpoint,
          identifier: data.gptIdentifier,
          authMode: data.gptAuthMode,
          apiKey: data.gptApiKey || ""
        },
        mai: {
          endpoint: data.maiEndpoint,
          identifier: data.maiIdentifier,
          authMode: data.maiAuthMode,
          apiKey: data.maiApiKey || ""
        }
      })
    });
    renderStatus();
    closeSettings();
    showToast("Live endpoint settings saved and applied.");
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  } finally {
    setButtonLoading(button, false);
  }
}

function activateDemo(id) {
  $$(".demo-tab").forEach((button) => {
    const active = button.dataset.demo === id;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $$(".demo-panel").forEach((panel) => {
    const active = panel.id === id;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
  document.querySelector(`#${id}`).scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderPropertySelect() {
  const select = $("#marketing-property");
  select.innerHTML = state.listings
    .map((listing) => `<option value="${escapeHtml(listing.id)}">${escapeHtml(listing.name)} · ${escapeHtml(listing.area)}</option>`)
    .join("");
  renderSelectedProperty();
}

function renderSelectedProperty() {
  const property = listingById($("#marketing-property").value);
  if (!property) return;
  $("#selected-property").innerHTML = `
    <img src="${escapeHtml(property.image)}" alt="">
    <span><strong>${escapeHtml(property.name)}</strong><span>${money.format(property.price)} · ${property.beds} bed · ${property.baths} bath</span></span>
  `;
}

function renderLeadList() {
  $("#lead-count").textContent = state.leads.length;
  $("#lead-list").innerHTML = state.leads.map((lead) => `
    <button class="lead-item${lead.id === state.selectedLeadId ? " is-active" : ""}" type="button" data-lead-id="${escapeHtml(lead.id)}" role="listitem">
      <span class="avatar">${escapeHtml(lead.initials)}</span>
      <span><strong>${escapeHtml(lead.name)}</strong><small>${escapeHtml(lead.source)}</small></span>
      <span class="lead-time">${escapeHtml(lead.received)}</span>
    </button>
  `).join("");
}

function selectLead(id) {
  state.selectedLeadId = id;
  renderLeadList();
  const lead = leadById(id);
  const property = listingById(lead.propertyId);
  $("#lead-detail").innerHTML = `
    <div class="lead-header">
      <div class="lead-person">
        <span class="avatar">${escapeHtml(lead.initials)}</span>
        <div><h3>${escapeHtml(lead.name)}</h3><p>${escapeHtml(lead.contact)} · ${escapeHtml(lead.source)}</p></div>
      </div>
      <span class="model-chip">Awaiting qualification</span>
    </div>
    <article class="enquiry-card">
      <div class="enquiry-meta"><span>Inbound enquiry</span><span>${escapeHtml(property.name)} · ${escapeHtml(lead.received)}</span></div>
      <blockquote>“${escapeHtml(lead.message)}”</blockquote>
    </article>
    <div class="qualify-intro">
      <div>
        <p>Analyse requirements, timeframe and buying signals, then prepare a personal response for review.</p>
        <button class="button button-primary" id="qualify-button" type="button">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z"/></svg>
          <span>Qualify this lead</span>
        </button>
      </div>
    </div>
  `;
  $("#qualify-button").addEventListener("click", qualifySelectedLead);
}

async function submitMatch(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const data = Object.fromEntries(new FormData(form));
  const container = $("#match-results");

  setButtonLoading(button, true, "Analysing the brief…");
  container.className = "";
  container.innerHTML = loadingMarkup("Comparing intent, fit and trade-offs…");

  try {
    const result = await api("/api/match", {
      method: "POST",
      body: JSON.stringify({ mode: state.mode, brief: data })
    });
    $("#match-result-title").textContent = `${result.results.length} considered matches`;
    container.innerHTML = `
      <p class="result-summary">${escapeHtml(result.summary)}</p>
      <div class="property-results">
        ${result.results.map((match) => {
          const property = listingById(match.id);
          if (!property) return "";
          return `
            <article class="property-card">
              <div class="property-card-image">
                <img src="${escapeHtml(property.image)}" alt="Illustrated view of ${escapeHtml(property.name)}">
                <span class="match-score"><strong>${match.score}</strong><small>% fit</small></span>
              </div>
              <div class="property-card-body">
                <div class="property-title-row">
                  <div><h4>${escapeHtml(property.name)}</h4><p class="property-location">${escapeHtml(property.location)}</p></div>
                  <span class="property-price">${money.format(property.price)}</span>
                </div>
                <div class="property-specs"><span>${property.beds} bed</span><span>${property.baths} bath</span><span>${property.parking} car</span><span>${escapeHtml(property.type)}</span></div>
                <div class="tag-row">${match.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
                <p class="rationale">${escapeHtml(match.rationale)}</p>
                <p class="tradeoff"><strong>Consider</strong> · ${escapeHtml(match.tradeoffs.join(" · "))}</p>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  } catch (error) {
    container.innerHTML = errorMarkup(error);
  } finally {
    setButtonLoading(button, false);
  }
}

async function submitMarketing(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const data = Object.fromEntries(new FormData(form));
  const output = $("#marketing-output");

  setButtonLoading(button, true, "Creating campaign…");
  output.innerHTML = loadingMarkup("Finding the campaign’s distinctive point of view…");

  try {
    state.marketing = await api("/api/marketing", {
      method: "POST",
      body: JSON.stringify({
        mode: state.mode,
        propertyId: data.propertyId,
        settings: { audience: data.audience, channel: data.channel, tone: data.tone }
      })
    });
    renderCampaign();
  } catch (error) {
    output.innerHTML = errorMarkup(error);
  } finally {
    setButtonLoading(button, false);
  }
}

function renderCampaign(imageResult = null) {
  const campaign = state.marketing;
  const property = listingById(campaign.propertyId);
  const imageUrl = imageResult?.imageUrl || property.image;
  const modelLabel = imageResult?.model || (state.mode === "live" ? "Property image · MAI ready" : "Bundled property artwork");

  $("#marketing-output").innerHTML = `
    <article class="campaign">
      <div class="campaign-hero">
        <img src="${escapeHtml(imageUrl)}" alt="Campaign visual for ${escapeHtml(property.name)}">
        <div class="campaign-overlay">
          <p class="eyebrow">${escapeHtml(property.location)}</p>
          <h3>${escapeHtml(campaign.headline)}</h3>
        </div>
      </div>
      <div class="campaign-body">
        <div class="campaign-copy"><p>${escapeHtml(campaign.description)}</p></div>
        <div class="campaign-side">
          <p class="eyebrow">Property highlights</p>
          <ul class="highlight-list">${campaign.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
        </div>
      </div>
      <div class="campaign-extras">
        <div class="social-card">
          <button class="copy-mini" type="button" data-copy="${escapeHtml(campaign.socialCopy)}">Copy</button>
          <h4>Social copy</h4><p>${escapeHtml(campaign.socialCopy)}</p>
        </div>
        <div class="prompt-card">
          <button class="copy-mini" type="button" data-copy="${escapeHtml(campaign.imagePrompt)}">Copy</button>
          <h4>Image direction</h4><p>${escapeHtml(campaign.imagePrompt)}</p>
        </div>
      </div>
      <div class="image-actions">
        <p>${escapeHtml(modelLabel)}</p>
        <button class="button button-gold" type="button" id="generate-image-button" data-action-label="${imageResult ? "Regenerate hero image" : "Generate hero image"}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M16 9h.01"/></svg>
          <span>${imageResult ? "Regenerate hero image" : "Generate hero image"}</span>
        </button>
      </div>
    </article>
  `;
  $$("#marketing-output [data-copy]").forEach((button) => button.addEventListener("click", () => copyText(button.dataset.copy)));
  $("#generate-image-button").addEventListener("click", generateImage);
  updateImageButton();
}

function updateImageButton() {
  const button = $("#generate-image-button");
  if (!button || !state.status) return;
  const unavailable = state.mode === "live" && !state.status.mai.configured;
  button.disabled = unavailable;
  button.title = unavailable ? "Configure MAI credentials on the server first." : "";
  button.querySelector("span").textContent = unavailable ? "MAI not configured" : button.dataset.actionLabel;
}

async function generateImage() {
  const button = $("#generate-image-button");
  setButtonLoading(button, true, "Generating with MAI…");
  try {
    const result = await api("/api/image", {
      method: "POST",
      body: JSON.stringify({
        mode: state.mode,
        propertyId: state.marketing.propertyId,
        prompt: state.marketing.imagePrompt,
        width: 1024,
        height: 1024
      })
    });
    renderCampaign(result);
    showToast(result.generated ? "Hero image generated." : "Mock creative preview applied.");
  } catch (error) {
    showToast(error.message);
    setButtonLoading(button, false);
  }
}

async function qualifySelectedLead() {
  const lead = leadById(state.selectedLeadId);
  const property = listingById(lead.propertyId);
  const detail = $("#lead-detail");
  const header = detail.querySelector(".lead-header").outerHTML;
  const enquiry = detail.querySelector(".enquiry-card").outerHTML;
  detail.innerHTML = `${header}${enquiry}${loadingMarkup("Reading buying signals and preparing the next move…")}`;

  try {
    const result = await api("/api/qualify", {
      method: "POST",
      body: JSON.stringify({ mode: state.mode, leadId: lead.id })
    });
    detail.innerHTML = `
      <div class="lead-header">
        <div class="lead-person">
          <span class="avatar">${escapeHtml(lead.initials)}</span>
          <div><h3>${escapeHtml(lead.name)}</h3><p>${escapeHtml(lead.contact)} · ${escapeHtml(lead.source)}</p></div>
        </div>
        <span class="model-chip">${escapeHtml(result.grade)} lead</span>
      </div>
      <article class="enquiry-card">
        <div class="enquiry-meta"><span>Inbound enquiry</span><span>${escapeHtml(property.name)} · ${escapeHtml(lead.received)}</span></div>
        <blockquote>“${escapeHtml(lead.message)}”</blockquote>
      </article>
      <div class="qualification">
        <div class="qualification-top">
          <div class="score-card"><strong>${result.score}</strong><span>Qualification score</span></div>
          <div class="qualification-facts">
            <div class="fact"><span>Grade</span><strong>${escapeHtml(result.grade)}</strong></div>
            <div class="fact"><span>Intent</span><strong>${escapeHtml(result.intent)}</strong></div>
            <div class="fact"><span>Urgency</span><strong>${escapeHtml(result.urgency)}</strong></div>
            <div class="fact"><span>Source</span><strong>${escapeHtml(lead.source)}</strong></div>
          </div>
        </div>
        <div class="analysis-card">
          <h4>Extracted requirements</h4>
          <div class="requirements">${result.requirements.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
        </div>
        <div class="analysis-card"><h4>Why this score</h4><p>${escapeHtml(result.rationale)}</p></div>
        <div class="analysis-card"><h4>Recommended next action</h4><p>${escapeHtml(result.nextAction)}</p></div>
        <div class="follow-up">
          <div class="follow-up-head"><div><p class="eyebrow">Personalised draft</p><h4>${escapeHtml(result.followUpSubject)}</h4></div><button class="button button-secondary" id="copy-follow-up" type="button">Copy draft</button></div>
          <label for="follow-up-text">Edit before sending</label>
          <textarea id="follow-up-text">${escapeHtml(result.followUpDraft)}</textarea>
        </div>
      </div>
    `;
    $("#copy-follow-up").addEventListener("click", () => copyText($("#follow-up-text").value));
  } catch (error) {
    detail.innerHTML = `${header}${enquiry}${errorMarkup(error)}`;
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard.");
  } catch {
    showToast("Clipboard access is unavailable.");
  }
}

function wireEvents() {
  $$(".demo-tab").forEach((button) => button.addEventListener("click", () => activateDemo(button.dataset.demo)));
  $$(".mode-option").forEach((button) => button.addEventListener("click", () => updateMode(button.dataset.mode)));
  $("#match-form").addEventListener("submit", submitMatch);
  $("#marketing-form").addEventListener("submit", submitMarketing);
  $("#marketing-property").addEventListener("change", renderSelectedProperty);
  $("#lead-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-lead-id]");
    if (button) selectLead(button.dataset.leadId);
  });
  $("#status-button").addEventListener("click", () => {
    const popover = $("#status-popover");
    popover.hidden = !popover.hidden;
    $("#status-button").setAttribute("aria-expanded", String(!popover.hidden));
  });
  $("#configure-button").addEventListener("click", openSettings);
  $("#settings-form").addEventListener("submit", saveSettings);
  $("#gpt-auth-mode").addEventListener("change", renderGptAuthMode);
  $("#mai-auth-mode").addEventListener("change", renderMaiAuthMode);
  $("#settings-close").addEventListener("click", closeSettings);
  $("#settings-cancel").addEventListener("click", closeSettings);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      $("#status-popover").hidden = true;
      $("#status-button").setAttribute("aria-expanded", "false");
    }
  });
}

async function initialize() {
  wireEvents();
  try {
    const [status, bootstrap] = await Promise.all([api("/api/status"), api("/api/bootstrap")]);
    state.status = status;
    state.listings = bootstrap.listings;
    state.leads = bootstrap.leads;
    renderStatus();
    renderPropertySelect();
    renderLeadList();
    selectLead(state.leads[0].id);
  } catch (error) {
    $("#status-label").textContent = "Server unavailable";
    showToast(error.message);
  }
}

initialize();
