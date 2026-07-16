const state = {
  mode: "mock",
  status: null,
  listings: [],
  leads: [],
  leases: [],
  buildings: [],
  maintenanceAssets: [],
  esgPortfolio: null,
  assistantHistory: [],
  assistantPending: false,
  maintenanceRequestId: 0,
  esgRequestId: 0,
  selectedLeadId: null,
  marketing: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 });

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

function inputsChangedMarkup(subject) {
  return `<div class="preview-placeholder" aria-live="polite"><p class="eyebrow">Inputs changed</p><h3>${escapeHtml(subject)} is ready to refresh.</h3><p>Run the analysis again to use the current settings.</p></div>`;
}

function invalidateGeneratedOutput(selector, subject) {
  const output = $(selector);
  if (output?.querySelector(".loading-state, .maintenance-report, .esg-report")) {
    output.innerHTML = inputsChangedMarkup(subject);
  }
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
  state.maintenanceRequestId += 1;
  state.esgRequestId += 1;
  invalidateGeneratedOutput("#maintenance-output", "Condition analysis");
  invalidateGeneratedOutput("#esg-output", "Sustainability draft");
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

function activateDemo(id, updateLocation = true) {
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
  if (updateLocation && window.location.hash !== `#${id}`) {
    history.replaceState(null, "", `#${id}`);
  }
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelector(`#${id}`).scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
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

function renderValuationPropertySelect() {
  const select = $("#valuation-property");
  select.innerHTML = state.listings
    .map((listing) => `<option value="${escapeHtml(listing.id)}">${escapeHtml(listing.name)} · ${escapeHtml(listing.area)}</option>`)
    .join("");
  renderValuationSubject();
}

function renderValuationSubject() {
  const property = listingById($("#valuation-property").value);
  if (!property) return;
  $("#valuation-subject").innerHTML = `
    <img src="${escapeHtml(property.image)}" alt="">
    <span><strong>${escapeHtml(property.name)}</strong><span>${money.format(property.price)} guide · ${property.beds} bed · ${escapeHtml(property.type)}</span></span>
  `;
}

function leaseById(id) {
  return state.leases.find((lease) => lease.id === id);
}

function renderLeaseSelect() {
  $("#lease-document").innerHTML = state.leases
    .map((lease) => `<option value="${escapeHtml(lease.id)}">${escapeHtml(lease.title)}</option>`)
    .join("");
  renderLeaseSource();
}

function renderLeaseSource() {
  const lease = leaseById($("#lease-document").value);
  if (!lease) return;
  const excerpt = lease.content.length > 520 ? `${lease.content.slice(0, 520)}…` : lease.content;
  $("#lease-source").innerHTML = `
    <div class="lease-file-head">
      <span class="file-badge">PDF</span>
      <div><strong>${escapeHtml(lease.fileName)}</strong><small>${lease.pageCount} pages · ${escapeHtml(lease.updated)}</small></div>
    </div>
    <p>${escapeHtml(lease.source)}</p>
    <pre>${escapeHtml(excerpt)}</pre>
  `;
}

function buildingById(id) {
  return state.buildings.find((building) => building.id === id);
}

function renderAssistantBuilding() {
  const building = buildingById($("#assistant-building").value);
  if (!building) return;
  $("#assistant-building-profile").innerHTML = `
    <p class="eyebrow">${escapeHtml(building.type)}</p>
    <h4>${escapeHtml(building.name)}</h4>
    <p>${escapeHtml(building.address)}</p>
    <dl><div><dt>Service desk</dt><dd>${escapeHtml(building.serviceHours)}</dd></div><div><dt>Urgent support</dt><dd>${escapeHtml(building.emergencyContact)}</dd></div></dl>
  `;
  $("#assistant-chat-context").textContent = `${building.name} · 24/7 support`;
  state.assistantHistory = [{
    role: "assistant",
    content: `Welcome to ${building.name}. I can answer building questions, explain tenant services and help log a maintenance request. How can I help?`
  }];
  renderAssistantMessages();
}

function renderAssistantBuildingSelect() {
  $("#assistant-building").innerHTML = state.buildings
    .map((building) => `<option value="${escapeHtml(building.id)}">${escapeHtml(building.name)} · ${escapeHtml(building.type)}</option>`)
    .join("");
  renderAssistantBuilding();
}

function renderAssistantMessages() {
  const container = $("#chat-messages");
  container.innerHTML = state.assistantHistory.map((message) => {
    const response = message.response;
    return `
      <article class="chat-message ${message.role === "user" ? "is-user" : "is-assistant"}">
        <span class="chat-speaker">${message.role === "user" ? "You" : "Aurelia"}</span>
        <div class="message-bubble"><p>${escapeHtml(message.content)}</p></div>
        ${response ? `
          <div class="assistant-result">
            <div class="triage-row">
              <span class="triage-badge urgency-${response.urgency.toLowerCase()}">${escapeHtml(response.urgency)}</span>
              <span>${escapeHtml(response.category)}</span>
            </div>
            ${response.workOrder.created ? `
              <div class="work-order-card">
                <span>Work order created</span><strong>${escapeHtml(response.workOrder.reference)}</strong>
                <p>${escapeHtml(response.workOrder.summary)}</p><small>${escapeHtml(response.workOrder.nextUpdate)}</small>
              </div>
            ` : ""}
            <p class="assistant-action"><strong>Next step</strong>${escapeHtml(response.recommendedAction)}</p>
            <div class="assistant-citations"><span>Sources</span>${response.citations.map((citation) => `<i>${escapeHtml(citation)}</i>`).join("")}</div>
            <div class="assistant-followups">${response.suggestions.map((suggestion) => `<button type="button" data-assistant-prompt="${escapeHtml(suggestion)}"${state.assistantPending ? " disabled" : ""}>${escapeHtml(suggestion)}</button>`).join("")}</div>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");
  container.scrollTop = container.scrollHeight;
}

function maintenanceAssetById(id) {
  return state.maintenanceAssets.find((asset) => asset.id === id);
}

function sparklinePoints(values, width = 300, height = 86) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values.map((value, index) => {
    const x = index * width / (values.length - 1);
    const y = height - ((value - min) / range) * (height - 12) - 6;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function renderMaintenanceAssetSelect() {
  $("#maintenance-asset").innerHTML = state.maintenanceAssets
    .map((asset) => `<option value="${escapeHtml(asset.id)}">${escapeHtml(asset.buildingName)} · ${escapeHtml(asset.name)}</option>`)
    .join("");
  renderMaintenanceAssetProfile();
}

function renderMaintenanceAssetProfile() {
  state.maintenanceRequestId += 1;
  const asset = maintenanceAssetById($("#maintenance-asset").value);
  if (!asset) return;
  const latest = asset.trend.at(-1);
  $("#maintenance-asset-profile").innerHTML = `
    <div class="asset-profile-head">
      <div><p class="eyebrow">${escapeHtml(asset.system)}</p><h4>${escapeHtml(asset.name)}</h4><span>${escapeHtml(asset.buildingName)} · ${escapeHtml(asset.location)}</span></div>
      <i>${escapeHtml(asset.criticality)}</i>
    </div>
    <div class="asset-trend">
      <div><span>Latest condition trend</span><strong>${escapeHtml(latest)} <small>${escapeHtml(asset.trendUnit)}</small></strong></div>
      <svg viewBox="0 0 300 86" role="img" aria-label="${escapeHtml(asset.trendUnit)} trend"><path d="M0 80H300"/><polyline points="${sparklinePoints(asset.trend)}"/></svg>
    </div>
    <dl>
      <div><dt>Last service</dt><dd>${escapeHtml(asset.lastService)}</dd></div>
      <div><dt>Data coverage</dt><dd>${asset.dataCompleteness}%</dd></div>
      <div><dt>Operating hours</dt><dd>${asset.operatingHours.toLocaleString("en-AU")}</dd></div>
    </dl>
  `;
}

function renderEsgScopeSelect() {
  $("#esg-scope").innerHTML = [
    '<option value="portfolio">Aurelia managed portfolio</option>',
    ...state.esgPortfolio.buildings.map((building) => `<option value="${escapeHtml(building.buildingId)}">${escapeHtml(building.name)} · ${escapeHtml(building.type)}</option>`)
  ].join("");
  renderEsgSourceOverview();
}

function renderEsgSourceOverview() {
  state.esgRequestId += 1;
  const scope = $("#esg-scope").value;
  const buildings = scope === "portfolio"
    ? state.esgPortfolio.buildings
    : state.esgPortfolio.buildings.filter((building) => building.buildingId === scope);
  const floorArea = buildings.reduce((sum, building) => sum + building.floorAreaSqm, 0);
  const completeness = decimal.format(buildings.reduce((sum, building) => sum + building.dataCompleteness * building.floorAreaSqm, 0) / floorArea);
  $("#esg-source-overview").innerHTML = `
    <p class="eyebrow">Evidence connected</p>
    <h4>${buildings.length} managed ${buildings.length === 1 ? "asset" : "assets"}</h4>
    <div class="esg-evidence-counts">
      <span><strong>12</strong> meter periods</span>
      <span><strong>${completeness}%</strong> data complete</span>
      <span><strong>${state.esgPortfolio.disclosures.length}</strong> disclosure topics</span>
    </div>
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
                <img src="${escapeHtml(property.image)}" alt="Exterior or interior photograph of ${escapeHtml(property.name)}">
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
  const hasImageEdit = Boolean(imageResult);
  const editedImageClass = imageResult && !imageResult.generated ? " comparison-image-mock" : "";
  const imageStatusTitle = imageResult ? "Comparison ready" : "Source photograph";
  const activeImagePrompt = imageResult?.prompt || campaign.imagePrompt;
  const liveImageEdit = imageResult?.mode === "live" && imageResult.generated;
  const provenanceLabel = liveImageEdit
    ? `Live Foundry · edited by ${imageResult.model}`
    : "Mock data · simulated grade only · MAI was not called";
  const modelLabel = imageResult
    ? liveImageEdit
      ? `Campaign edit · ${imageResult.model} · original preserved`
      : "Mock image-grade preview · no model call · original preserved"
    : "Authentic base photograph · generated with MAI-Image-2.5";
  const actionLabel = imageResult ? "Regenerate campaign edit" : "Brush up base image";
  const campaignVisual = hasImageEdit
    ? `
      <section class="campaign-comparison" aria-labelledby="image-comparison-title">
        <div class="comparison-heading">
          <div>
            <p class="eyebrow">Image transformation</p>
            <h3 id="image-comparison-title">Before and after</h3>
          </div>
          <div class="comparison-provenance">
            <span class="${liveImageEdit ? "is-live" : "is-mock"}">${escapeHtml(provenanceLabel)}</span>
            <p>The campaign edit refines light, exposure and tone while preserving the property, landscaping and camera position.</p>
          </div>
        </div>
        <div class="comparison-grid">
          <figure>
            <div class="comparison-image">
              <img src="${escapeHtml(property.image)}" alt="Original photograph of ${escapeHtml(property.name)}">
              <span>Before</span>
            </div>
            <figcaption><strong>Authentic base photograph</strong><span>Original architecture and natural conditions</span></figcaption>
          </figure>
          <figure>
            <div class="comparison-image${editedImageClass}">
              <img src="${escapeHtml(imageUrl)}" alt="Campaign-edited photograph of ${escapeHtml(property.name)}">
              <span>After</span>
            </div>
            <figcaption>
              <strong>${liveImageEdit ? "Campaign-ready MAI edit" : "Simulated campaign preview"}</strong>
              <span>${escapeHtml(provenanceLabel)}</span>
            </figcaption>
          </figure>
        </div>
        <div class="comparison-changes" aria-label="Image changes">
          <span>Natural light refined</span>
          <span>Exposure balanced</span>
          <span>Editorial colour grade</span>
          <span>Property preserved</span>
        </div>
        <div class="campaign-message">
          <p class="eyebrow">${escapeHtml(campaign.campaignConcept)} · ${escapeHtml(property.location)}</p>
          <h3>${escapeHtml(campaign.headline)}</h3>
          <p>${escapeHtml(campaign.strapline)}</p>
        </div>
      </section>`
    : `
      <div class="campaign-hero">
        <img src="${escapeHtml(imageUrl)}" alt="Campaign visual for ${escapeHtml(property.name)}">
        <div class="campaign-overlay">
          <p class="eyebrow">${escapeHtml(campaign.campaignConcept)} · ${escapeHtml(property.location)}</p>
          <h3>${escapeHtml(campaign.headline)}</h3>
          <p class="campaign-strapline">${escapeHtml(campaign.strapline)}</p>
        </div>
      </div>`;

  $("#marketing-output").innerHTML = `
    <article class="campaign">
      ${campaignVisual}
      <div class="campaign-body">
        <div class="campaign-copy">
          <p>${escapeHtml(campaign.description)}</p>
          <div class="campaign-cta"><span>Invitation</span><strong>${escapeHtml(campaign.callToAction)}</strong></div>
        </div>
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
          <button class="copy-mini" type="button" data-copy-target="#image-edit-prompt">Copy</button>
          <h4>Image edit prompt</h4>
          <label class="prompt-editor-label" for="image-edit-prompt">Editable direction sent to the image service</label>
          <textarea id="image-edit-prompt" maxlength="2000" rows="7" aria-describedby="image-prompt-help">${escapeHtml(activeImagePrompt)}</textarea>
          <small id="image-prompt-help">Adjust the lighting, season, staging or campaign mood. The server always adds safeguards that preserve the property itself.</small>
        </div>
      </div>
      <div class="image-actions">
        <div class="image-source">
          <img src="${escapeHtml(property.image)}" alt="">
          <span><strong>${imageStatusTitle}</strong>${escapeHtml(modelLabel)}</span>
        </div>
        <button class="button button-gold" type="button" id="generate-image-button" data-action-label="${actionLabel}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M16 9h.01"/></svg>
          <span>${actionLabel}</span>
        </button>
      </div>
      <div class="image-feedback" id="image-feedback" role="alert" hidden></div>
    </article>
  `;
  $$("#marketing-output [data-copy]").forEach((button) => button.addEventListener("click", () => copyText(button.dataset.copy)));
  $$("#marketing-output [data-copy-target]").forEach((button) => button.addEventListener("click", () => {
    copyText($(button.dataset.copyTarget).value);
  }));
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
  const campaign = state.marketing;
  const feedback = $("#image-feedback");
  const promptField = $("#image-edit-prompt");
  const prompt = promptField.value.trim();
  feedback.hidden = true;
  if (prompt.length < 20) {
    feedback.innerHTML = "<strong>Add more image direction.</strong><span>Describe the intended lighting, tone or presentation in at least 20 characters.</span>";
    feedback.hidden = false;
    promptField.focus();
    return;
  }

  setButtonLoading(button, true, state.mode === "live" ? "Editing with MAI…" : "Applying mock preview…");
  promptField.disabled = true;
  try {
    const result = await api("/api/image", {
      method: "POST",
      body: JSON.stringify({
        mode: state.mode,
        propertyId: campaign.propertyId,
        prompt
      })
    });
    if (state.marketing !== campaign) return;
    renderCampaign(result);
    showToast(result.generated ? `Edited by ${result.model} in Live Foundry mode.` : "Mock preview applied. MAI was not called.");
  } catch (error) {
    if (state.marketing !== campaign) return;
    promptField.disabled = false;
    feedback.innerHTML = `<strong>MAI image edit did not complete.</strong><span>${escapeHtml(error.message)}</span><small>The original property photograph is unchanged. Retry when the service is available.</small>`;
    feedback.hidden = false;
    showToast(error.message);
    setButtonLoading(button, false);
  }
}

async function submitValuation(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const data = Object.fromEntries(new FormData(form));
    const output = $("#valuation-output");
    setButtonLoading(button, true, "Reconciling evidence…");
    output.innerHTML = loadingMarkup("Adjusting comparable sales and drafting the valuer review…");

    try {
      const result = await api("/api/valuation", {
        method: "POST",
        body: JSON.stringify({
          mode: state.mode,
          propertyId: data.propertyId,
          settings: { purpose: data.purpose, condition: data.condition, valuerNotes: data.valuerNotes }
        })
      });
      renderValuation(result);
    } catch (error) {
      output.innerHTML = errorMarkup(error);
    } finally {
      setButtonLoading(button, false);
    }
}

function renderValuation(result) {
    const property = listingById(result.propertyId);
    $("#valuation-output").innerHTML = `
      <article class="valuation-report">
        <header class="valuation-report-head">
          <div><p class="eyebrow">Indicative valuation · ${escapeHtml(result.effectiveDate)}</p><h3>${escapeHtml(property.name)}</h3><p>${escapeHtml(property.location)}</p></div>
          <span class="model-chip">${escapeHtml(result.confidence)} confidence</span>
        </header>
        <div class="value-conclusion">
          <div><span>Adopted midpoint</span><strong>${money.format(result.valueMid)}</strong></div>
          <div><span>Indicative range</span><strong>${money.format(result.valueLow)} — ${money.format(result.valueHigh)}</strong></div>
        </div>
        <p class="valuation-summary">${escapeHtml(result.summary)}</p>
        <section class="report-section">
          <div class="report-section-head"><div><p class="eyebrow">Comparable evidence</p><h4>Adjusted transactions</h4></div><span>${result.comparables.length} sales reconciled</span></div>
          <div class="comparable-table" role="table" aria-label="Comparable sales">
            <div class="comparable-row comparable-header" role="row"><span>Transaction</span><span>Sale price</span><span>Adjusted</span><span>Weight</span></div>
            ${result.comparables.map((comparable) => `
              <div class="comparable-row" role="row">
                <span><strong>${escapeHtml(comparable.address)}</strong><small>${escapeHtml(comparable.saleDate)} · ${escapeHtml(comparable.rationale)}</small><i>${comparable.adjustments.map(escapeHtml).join(" · ")}</i></span>
                <span>${money.format(comparable.salePrice)}</span>
                <span>${money.format(comparable.adjustedValue)}</span>
                <span><b>${comparable.weight}%</b></span>
              </div>
            `).join("")}
          </div>
        </section>
        <div class="report-columns">
          <section class="report-card"><p class="eyebrow">Market view</p><h4>Reconciliation</h4><p>${escapeHtml(result.marketCommentary)}</p></section>
          <section class="report-card"><p class="eyebrow">Review controls</p><h4>Assumptions</h4><ul>${result.assumptions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
        </div>
        <section class="report-card risk-card"><p class="eyebrow">Sensitivity</p><h4>Risks to the opinion</h4><ul>${result.risks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
        <footer class="report-signoff"><strong>Valuer sign-off required</strong><span>${escapeHtml(result.signOff)}</span></footer>
      </article>
    `;
}

async function submitLease(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = $('button[type="submit"]', form);
    const { leaseId } = Object.fromEntries(new FormData(form));
    const output = $("#lease-output");
    setButtonLoading(button, true, "Reading the agreement…");
    output.innerHTML = loadingMarkup("Extracting terms, obligations and review flags…");

    try {
      const result = await api("/api/lease", {
        method: "POST",
        body: JSON.stringify({ mode: state.mode, leaseId })
      });
      renderLeaseAbstraction(result);
    } catch (error) {
      output.innerHTML = errorMarkup(error);
    } finally {
      setButtonLoading(button, false);
    }
}

function renderLeaseAbstraction(result) {
    const terms = [
      ["Premises", result.premises],
      ["Initial term", `${result.term.initialTerm} · ${result.term.commencement} to ${result.term.expiry}`],
      ["Options", result.term.options],
      ["Base rent", `${result.rent.baseAnnual} · ${result.rent.payment}`],
      ["Rent review", result.rent.review],
      ["Incentive", result.incentive],
      ["Security", result.security],
      ["Outgoings", result.outgoings],
      ["Permitted use", result.permittedUse],
      ["Break rights", result.breakClause]
    ];
    $("#lease-output").innerHTML = `
      <article class="lease-abstraction">
        <header class="lease-report-head">
          <div><p class="eyebrow">Structured lease abstraction</p><h3>${escapeHtml(result.documentTitle)}</h3></div>
          <button class="button button-secondary" id="copy-lease-summary" type="button">Copy summary</button>
        </header>
        <div class="party-strip">
          <div><span>Landlord</span><strong>${escapeHtml(result.parties.landlord)}</strong></div>
          <div><span>Tenant</span><strong>${escapeHtml(result.parties.tenant)}</strong></div>
        </div>
        <p class="lease-summary">${escapeHtml(result.executiveSummary)}</p>
        <section class="report-section"><p class="eyebrow">Key commercial terms</p><div class="terms-grid">${terms.map(([label, value]) => `<div class="term-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div></section>
        <div class="report-columns">
          <section class="report-card"><p class="eyebrow">Tenant</p><h4>Key obligations</h4><ul>${result.tenantObligations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
          <section class="report-card"><p class="eyebrow">Landlord</p><h4>Key obligations</h4><ul>${result.landlordObligations.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
        </div>
        <section class="report-section"><div class="report-section-head"><div><p class="eyebrow">Diary</p><h4>Critical dates</h4></div></div><div class="critical-dates">${result.criticalDates.map((item) => `<div><time>${escapeHtml(item.date)}</time><span><strong>${escapeHtml(item.event)}</strong><small>${escapeHtml(item.owner)} owner</small></span></div>`).join("")}</div></section>
        <section class="report-section"><div class="report-section-head"><div><p class="eyebrow">Review queue</p><h4>Risks &amp; exceptions</h4></div><span>${result.risks.length} flags</span></div><div class="lease-risks">${result.risks.map((risk) => `<article class="lease-risk severity-${risk.severity.toLowerCase()}"><span>${escapeHtml(risk.severity)}</span><div><strong>${escapeHtml(risk.title)}</strong><p>${escapeHtml(risk.detail)}</p><small>${escapeHtml(risk.clause)}</small></div></article>`).join("")}</div></section>
        <footer class="report-signoff"><strong>Professional review required</strong><span>${escapeHtml(result.reviewNote)}</span></footer>
      </article>
    `;
    $("#copy-lease-summary").addEventListener("click", () => copyText(result.executiveSummary));
}

async function submitAssistantMessage(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const textarea = $("#assistant-message");
  const button = $('button[type="submit"]', form);
  const message = textarea.value.trim();
  if (!message || state.assistantPending) return;
  const buildingId = $("#assistant-building").value;
  const history = state.assistantHistory
    .slice(-10)
    .map((entry) => ({ role: entry.role, content: entry.content }));
  state.assistantPending = true;
  state.assistantHistory.push({ role: "user", content: message });
  textarea.value = "";
  textarea.disabled = true;
  $("#assistant-building").disabled = true;
  renderAssistantMessages();
  setButtonLoading(button, true, "Thinking…");

  try {
    const result = await api("/api/assistant", {
      method: "POST",
      body: JSON.stringify({
        mode: state.mode,
        buildingId,
        message,
        history
      })
    });
    if ($("#assistant-building").value !== buildingId) return;
    state.assistantHistory.push({ role: "assistant", content: result.reply, response: result });
  } catch (error) {
    if ($("#assistant-building").value !== buildingId) return;
    state.assistantHistory.push({ role: "assistant", content: `I couldn't complete that request: ${error.message}` });
  } finally {
    state.assistantPending = false;
    textarea.disabled = false;
    $("#assistant-building").disabled = false;
    setButtonLoading(button, false);
    renderAssistantMessages();
    textarea.focus();
  }
}

async function submitMaintenance(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const { assetId, horizon } = Object.fromEntries(new FormData(form));
  const requestId = ++state.maintenanceRequestId;
  const output = $("#maintenance-output");
  output.dataset.requestId = String(requestId);
  $("#maintenance-asset").disabled = true;
  setButtonLoading(button, true, "Reading condition signals…");
  output.innerHTML = loadingMarkup("Reconciling telemetry, failure risk and energy impact…");

  try {
    const result = await api("/api/maintenance", {
      method: "POST",
      body: JSON.stringify({ mode: state.mode, assetId, horizon })
    });
    if (requestId !== state.maintenanceRequestId || $("#maintenance-asset").value !== assetId) return;
    renderMaintenanceAnalysis(result);
  } catch (error) {
    if (requestId === state.maintenanceRequestId) output.innerHTML = errorMarkup(error);
  } finally {
    if (requestId !== state.maintenanceRequestId && output.dataset.requestId === String(requestId) && output.querySelector(".loading-state")) {
      output.innerHTML = inputsChangedMarkup("Condition analysis");
    }
    $("#maintenance-asset").disabled = false;
    setButtonLoading(button, false);
  }
}

function renderMaintenanceAnalysis(result) {
  const asset = maintenanceAssetById(result.assetId);
  const riskClass = result.failureRisk.toLowerCase();
  $("#maintenance-output").innerHTML = `
    <article class="maintenance-report">
      <header class="operations-report-head">
        <div><p class="eyebrow">Condition analysis · ${escapeHtml(asset.buildingName)}</p><h3>${escapeHtml(asset.name)}</h3><p>${escapeHtml(asset.system)} · ${escapeHtml(asset.location)}</p></div>
        <span class="risk-badge risk-${riskClass}">${escapeHtml(result.failureRisk)} failure risk</span>
      </header>
      <div class="condition-overview">
        <div class="health-gauge" style="--health:${result.healthScore}">
          <div><strong>${result.healthScore}</strong><span>Asset health</span></div>
        </div>
        <div class="condition-conclusion">
          <p class="eyebrow">Predicted issue</p>
          <h4>${escapeHtml(result.predictedIssue)}</h4>
          <span>${escapeHtml(result.forecastWindow)} · ${result.confidence}% confidence</span>
          <p>${escapeHtml(result.summary)}</p>
        </div>
      </div>
      <section class="report-section">
        <div class="report-section-head"><div><p class="eyebrow">Explainable evidence</p><h4>Signals behind the risk</h4></div><span>${result.evidence.length} correlated readings</span></div>
        <div class="signal-grid">
          ${result.evidence.map((item) => `
            <article class="signal-card signal-${item.severity.toLowerCase()}">
              <div><span>${escapeHtml(item.label)}</span><i>${escapeHtml(item.severity)}</i></div>
              <strong>${escapeHtml(item.reading)}</strong>
              <p>${escapeHtml(item.interpretation)}</p>
            </article>
          `).join("")}
        </div>
      </section>
      <section class="energy-impact">
        <div><span>Excess demand</span><strong>${decimal.format(result.energyImpact.excessKwhPerDay)} kWh/day</strong></div>
        <div><span>Estimated cost</span><strong>${money.format(result.energyImpact.costPerMonth)}/month</strong></div>
        <div><span>Annual emissions</span><strong>${decimal.format(result.energyImpact.annualEmissionsTonnes)} tCO₂e</strong></div>
        <p>${escapeHtml(result.energyImpact.narrative)}</p>
      </section>
      <section class="report-section">
        <div class="report-section-head"><div><p class="eyebrow">Intervention plan</p><h4>Recommended actions</h4></div></div>
        <div class="action-timeline">
          ${result.actions.map((item, index) => `
            <article><span>${String(index + 1).padStart(2, "0")}</span><div><i>${escapeHtml(item.priority)}</i><strong>${escapeHtml(item.action)}</strong><small>${escapeHtml(item.owner)} · ${escapeHtml(item.timing)}</small></div></article>
          `).join("")}
        </div>
      </section>
      <div class="condition-work-order ${result.workOrder.created ? "is-created" : ""}">
        <span>${result.workOrder.created ? "Draft work order" : "Maintenance status"}</span>
        <strong>${escapeHtml(result.workOrder.reference || result.workOrder.title)}</strong>
        <p>${escapeHtml(result.workOrder.title)} · ${escapeHtml(result.workOrder.status)}</p>
      </div>
      <footer class="report-signoff"><strong>Human verification required</strong><span>${result.assumptions.map(escapeHtml).join(" ")}</span></footer>
    </article>
  `;
}

async function submitEsg(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  const settings = Object.fromEntries(new FormData(form));
  const requestId = ++state.esgRequestId;
  const output = $("#esg-output");
  output.dataset.requestId = String(requestId);
  $("#esg-scope").disabled = true;
  setButtonLoading(button, true, "Assembling the evidence…");
  output.innerHTML = loadingMarkup("Calculating portfolio metrics and drafting the management review…");

  try {
    const result = await api("/api/esg", {
      method: "POST",
      body: JSON.stringify({ mode: state.mode, settings })
    });
    if (requestId !== state.esgRequestId || $("#esg-scope").value !== settings.scope) return;
    renderEsgReport(result);
  } catch (error) {
    if (requestId === state.esgRequestId) output.innerHTML = errorMarkup(error);
  } finally {
    if (requestId !== state.esgRequestId && output.dataset.requestId === String(requestId) && output.querySelector(".loading-state")) {
      output.innerHTML = inputsChangedMarkup("Sustainability draft");
    }
    $("#esg-scope").disabled = false;
    setButtonLoading(button, false);
  }
}

function renderEsgReport(result) {
  $("#esg-output").innerHTML = `
    <article class="esg-report">
      <header class="operations-report-head">
        <div><p class="eyebrow">${escapeHtml(result.framework)}</p><h3>${escapeHtml(result.scope)}</h3><p>${escapeHtml(result.reportingPeriod)}</p></div>
        <span class="assurance-badge assurance-${result.assuranceStatus.toLowerCase().replace(/\s/g, "-")}">${escapeHtml(result.assuranceStatus)}</span>
      </header>
      <p class="esg-summary">${escapeHtml(result.executiveSummary)}</p>
      <section class="esg-metric-grid" aria-label="Sustainability metrics">
        ${result.metrics.map((metric) => `
          <article class="esg-metric status-${metric.status.toLowerCase().replace(/\s/g, "-")}">
            <span>${escapeHtml(metric.label)}</span>
            <strong>${decimal.format(metric.value)} <small>${escapeHtml(metric.unit)}</small></strong>
            <div><i>${metric.changePercent > 0 ? "↑" : "↓"} ${decimal.format(Math.abs(metric.changePercent))}% YoY</i><b>${escapeHtml(metric.status)}</b></div>
            <p>${escapeHtml(metric.commentary)}</p>
            <small>Target · ${escapeHtml(metric.target)}</small>
          </article>
        `).join("")}
      </section>
      <section class="report-section">
        <div class="report-section-head"><div><p class="eyebrow">Asset view</p><h4>Performance by building</h4></div><span>Calculated from source records</span></div>
        <div class="esg-table-scroll">
          <table class="esg-table">
            <caption class="sr-only">Building sustainability performance</caption>
            <thead><tr><th scope="col">Managed asset</th><th scope="col">Energy</th><th scope="col">Carbon</th><th scope="col">Water</th><th scope="col">Evidence</th></tr></thead>
            <tbody>${result.buildings.map((building) => `
              <tr>
                <th scope="row"><strong>${escapeHtml(building.name)}</strong><small>${escapeHtml(building.insight)}</small></th>
                <td>${decimal.format(building.energyIntensity)} kWh/m²</td>
                <td>${decimal.format(building.carbonIntensity)} kgCO₂e/m²</td>
                <td>${decimal.format(building.waterIntensity)} kL/m²</td>
                <td><b class="status-text-${building.status.toLowerCase().replace(/\s/g, "-")}">${building.dataCompleteness}% · ${escapeHtml(building.status)}</b></td>
              </tr>
            `).join("")}</tbody>
          </table>
        </div>
      </section>
      <section class="report-section">
        <div class="report-section-head"><div><p class="eyebrow">Disclosure readiness</p><h4>Evidence and gaps</h4></div><span>${result.disclosures.filter((item) => item.status === "Ready").length} ready</span></div>
        <div class="disclosure-grid">
          ${result.disclosures.map((item) => `
            <article class="disclosure-card disclosure-${item.status.toLowerCase()}">
              <div><strong>${escapeHtml(item.topic)}</strong><span>${escapeHtml(item.status)}</span></div>
              <p>${escapeHtml(item.summary)}</p>
              <small><b>Evidence</b>${escapeHtml(item.evidence)}</small>
              ${item.gap ? `<small><b>Gap</b>${escapeHtml(item.gap)}</small>` : ""}
            </article>
          `).join("")}
        </div>
      </section>
      <section class="report-section">
        <div class="report-section-head"><div><p class="eyebrow">90-day roadmap</p><h4>Prioritised actions</h4></div></div>
        <div class="esg-actions">
          ${result.actions.map((item) => `<article><span class="priority-${item.priority.toLowerCase()}">${escapeHtml(item.priority)}</span><div><strong>${escapeHtml(item.action)}</strong><p>${escapeHtml(item.impact)}</p><small>${escapeHtml(item.owner)} · ${escapeHtml(item.dueDate)}</small></div></article>`).join("")}
        </div>
      </section>
      <section class="methodology-note"><strong>Methodology</strong><span>${escapeHtml(result.methodology)}</span></section>
      <footer class="report-signoff"><strong>Review draft only</strong><span>${result.caveats.map(escapeHtml).join(" ")}</span></footer>
    </article>
  `;
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
    if (state.selectedLeadId !== lead.id) return;
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
    if (state.selectedLeadId !== lead.id) return;
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
  $("#valuation-form").addEventListener("submit", submitValuation);
  $("#valuation-property").addEventListener("change", renderValuationSubject);
  $("#lease-form").addEventListener("submit", submitLease);
  $("#lease-document").addEventListener("change", renderLeaseSource);
  $("#assistant-form").addEventListener("submit", submitAssistantMessage);
  $("#assistant-building").addEventListener("change", renderAssistantBuilding);
  $("#maintenance-form").addEventListener("submit", submitMaintenance);
  $("#maintenance-asset").addEventListener("change", renderMaintenanceAssetProfile);
  $("#maintenance-form").addEventListener("change", () => {
    state.maintenanceRequestId += 1;
    invalidateGeneratedOutput("#maintenance-output", "Condition analysis");
  });
  $("#esg-form").addEventListener("submit", submitEsg);
  $("#esg-scope").addEventListener("change", renderEsgSourceOverview);
  $("#esg-form").addEventListener("change", () => {
    state.esgRequestId += 1;
    invalidateGeneratedOutput("#esg-output", "Sustainability draft");
  });
  $(".assistant-workspace").addEventListener("click", (event) => {
    const prompt = event.target.closest("[data-assistant-prompt]")?.dataset.assistantPrompt;
    if (!prompt || state.assistantPending) return;
    $("#assistant-message").value = prompt;
    $("#assistant-form").requestSubmit();
  });
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
  window.addEventListener("hashchange", () => {
    const id = window.location.hash.slice(1);
    if ($(`.demo-tab[data-demo="${id}"]`)) activateDemo(id, false);
  });
}

async function initialize() {
  wireEvents();
  try {
    const [status, bootstrap] = await Promise.all([api("/api/status"), api("/api/bootstrap")]);
    state.status = status;
    state.listings = bootstrap.listings;
    state.leads = bootstrap.leads;
    state.leases = bootstrap.leaseDocuments;
    state.buildings = bootstrap.buildingProfiles;
    state.maintenanceAssets = bootstrap.maintenanceAssets;
    state.esgPortfolio = bootstrap.esgPortfolio;
    renderStatus();
    renderPropertySelect();
    renderLeadList();
    renderValuationPropertySelect();
    renderLeaseSelect();
    renderAssistantBuildingSelect();
    renderMaintenanceAssetSelect();
    renderEsgScopeSelect();
    selectLead(state.leads[0].id);
    const requestedDemo = window.location.hash.slice(1);
    if ($(`.demo-tab[data-demo="${requestedDemo}"]`)) activateDemo(requestedDemo, false);
  } catch (error) {
    $("#status-label").textContent = "Server unavailable";
    showToast(error.message);
  }
}

initialize();
