// Strata Regulatory Operations Workspace Frontend Logic

let currentProceeding = "FERC-RM22-14";
let cachedActions = [];
let targetOverrideActionId = null;

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initListeners();
  loadInitialData();
});

// Tab Navigation
function initTabs() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      const targetId = tab.getAttribute("data-tab");
      document.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add("active");
    });
  });
}

function initListeners() {
  // Proceeding dropdown
  const select = document.getElementById("proceeding-select");
  if (select) {
    select.addEventListener("change", (e) => {
      currentProceeding = e.target.value;
      updateProceedingBadge();
    });
  }

  // Run Analysis button
  const runBtn = document.getElementById("btn-run-analysis");
  if (runBtn) {
    runBtn.addEventListener("click", runAnalysis);
  }

  // Audit controls
  const auditBtn = document.getElementById("btn-load-audit");
  if (auditBtn) {
    auditBtn.addEventListener("click", () => {
      const streamId = document.getElementById("audit-stream-input").value.trim();
      loadAuditDossier(streamId);
    });
  }

  const solarAuditBtn = document.getElementById("btn-load-solar-audit");
  if (solarAuditBtn) {
    solarAuditBtn.addEventListener("click", () => {
      const streamId = "obligation:OBL-RIDETHRU-03";
      document.getElementById("audit-stream-input").value = streamId;
      loadAuditDossier(streamId);
    });
  }

  // Filter buttons in Action Inbox
  const filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderFilteredActions(btn.getAttribute("data-filter"));
    });
  });

  // Modal controls
  const closeBtn = document.getElementById("modal-close-btn");
  const cancelBtn = document.getElementById("modal-cancel-btn");
  const saveBtn = document.getElementById("modal-save-btn");

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  if (saveBtn) saveBtn.addEventListener("click", commitHumanOverride);
}

function updateProceedingBadge() {
  const badge = document.getElementById("proceeding-status-badge");
  if (badge) {
    badge.className = "badge badge-final";
    badge.textContent = "FINAL RULE";
  }
}

// Initial Data Fetch
async function loadInitialData() {
  try {
    const [projRes, oblRes, actRes] = await Promise.all([
      fetch("/projects"),
      fetch("/obligations"),
      fetch("/actions")
    ]);

    const projects = await projRes.json();
    const obligations = await oblRes.json();
    cachedActions = await actRes.json();

    renderProjects(projects);
    renderObligations(obligations);
    renderActions(cachedActions);

    // Initial audit load
    loadAuditDossier("obligation:OBL-CEMS-02");
  } catch (err) {
    console.error("Failed to load initial workspace data:", err);
  }
}

function renderProjects(projects) {
  const container = document.getElementById("projects-list");
  document.getElementById("metric-projects").textContent = projects.length;
  if (!projects.length) {
    container.innerHTML = '<div class="empty-state">No enterprise projects loaded.</div>';
    return;
  }
  container.innerHTML = projects.map(p => `
    <div class="card stat-card" style="margin-bottom: 0.75rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <strong style="color:#f3f4f6;">${escapeHtml(p.name)}</strong>
          <div style="font-size:0.75rem; color:#9ca3af; font-family:var(--font-mono); margin-top:2px;">${p.id} · Owner: ${p.owner_id}</div>
        </div>
        <span class="badge badge-final">${p.status}</span>
      </div>
      <p style="font-size:0.82rem; color:#9ca3af; margin-top:0.4rem;">${escapeHtml(p.description)}</p>
    </div>
  `).join("");
}

function renderObligations(obligations) {
  const container = document.getElementById("obligations-list");
  document.getElementById("metric-obligations").textContent = obligations.length;
  if (!obligations.length) {
    container.innerHTML = '<div class="empty-state">No compliance obligations loaded.</div>';
    return;
  }
  container.innerHTML = obligations.map(o => `
    <div class="card stat-card" style="margin-bottom: 0.75rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <strong style="color:#f3f4f6; font-family:var(--font-mono); font-size:0.85rem;">${o.id}</strong>
          <div style="font-size:0.75rem; color:#9ca3af;">Linked Doc: ${o.linked_doc_id || 'None'} · Owner: ${o.owner_id}</div>
        </div>
        <span class="badge badge-final">${o.status}</span>
      </div>
      <p style="font-size:0.82rem; color:#9ca3af; margin-top:0.4rem;">${escapeHtml(o.description)}</p>
    </div>
  `).join("");
}

// Run Analysis Flow
async function runAnalysis() {
  const runBtn = document.getElementById("btn-run-analysis");
  const origText = runBtn.innerHTML;
  runBtn.innerHTML = "Analyzing...";
  runBtn.disabled = true;

  try {
    const prevVer = currentProceeding === "FERC-RM22-14" ? "FERC-RM22-14_nopr" : "EPA-NSPS-KKKK_draft_revision";
    const currVer = currentProceeding === "FERC-RM22-14" ? "FERC-RM22-14_final_rule" : "EPA-NSPS-KKKK_final_rule";

    const res = await fetch(`/analyze?proceeding_id=${currentProceeding}&prev_version_id=${prevVer}&curr_version_id=${currVer}`, {
      method: "POST"
    });
    const data = await res.json();

    document.getElementById("metric-material").textContent = data.material_changes || 0;
    document.getElementById("metric-escalated").textContent = data.escalated_to_expert_review || 0;

    renderChanges(data.change_records || []);
    cachedActions = data.actions || [];
    renderActions(cachedActions);
    renderExpertQueue(data.escalated_items || []);

    // Switch to changes tab
    document.querySelector('[data-tab="tab-changes"]').click();
  } catch (err) {
    alert("Analysis failed: " + err);
  } finally {
    runBtn.innerHTML = origText;
    runBtn.disabled = false;
  }
}

function renderChanges(records) {
  const container = document.getElementById("changes-container");
  document.getElementById("badge-changes-count").textContent = records.length;

  if (!records.length) {
    container.innerHTML = '<div class="empty-state">No changes detected.</div>';
    return;
  }

  container.innerHTML = records.map(cr => `
    <div class="change-card">
      <div class="change-card-header">
        <div class="change-card-meta">
          <span class="badge badge-material">${cr.materiality}</span>
          <span class="badge" style="background:rgba(99,102,241,0.2); color:#a5b4fc;">${cr.change_type}</span>
          <span class="badge ${cr.confidence === 'LOW' ? 'badge-low' : 'badge-high'}">${cr.confidence} CONFIDENCE</span>
        </div>
        <span style="font-family:var(--font-mono); font-size:0.75rem; color:#6b7280;">${cr.id}</span>
      </div>
      <div class="change-desc">${escapeHtml(cr.description)}</div>
      
      <div class="citation-diff-box">
        <div class="diff-col">
          <h4>Before (NOPR / Draft)</h4>
          <div class="quote-before">"${escapeHtml(cr.before_citation ? cr.before_citation.quoted_text : 'No prior language (New Addition)')}"</div>
        </div>
        <div class="diff-col">
          <h4>After (Final Mandate)</h4>
          <div class="quote-after">"${escapeHtml(cr.after_citation ? cr.after_citation.quoted_text : 'Provisions removed')}"</div>
        </div>
      </div>
    </div>
  `).join("");
}

function renderActions(actions) {
  const container = document.getElementById("actions-container");
  document.getElementById("badge-actions-count").textContent = actions.length;

  if (!actions.length) {
    container.innerHTML = '<div class="empty-state">No routed action recommendations.</div>';
    return;
  }

  container.innerHTML = actions.map(act => `
    <div class="action-card ${act.urgency === 'ACT_NOW' ? 'urgent' : ''}">
      <div class="action-info">
        <div class="action-directive">${escapeHtml(act.recommended_action)}</div>
        <div class="action-meta">
          <span>Assigned Owner: <strong>${act.suggested_owner_id}</strong></span>
          <span>·</span>
          <span>Urgency: <span class="badge ${act.urgency === 'ACT_NOW' ? 'badge-material' : 'badge-proposed'}">${act.urgency}</span></span>
          <span>·</span>
          <span>Status: <strong style="color:${act.state === 'MODIFIED' ? '#f59e0b' : '#34d399'}">${act.state}</strong></span>
        </div>
      </div>
      <div class="action-buttons">
        <button class="btn btn-secondary btn-sm" onclick="openOverrideModal('${act.id}')">Modify Directive</button>
      </div>
    </div>
  `).join("");
}

function renderFilteredActions(filter) {
  if (filter === "ALL") {
    renderActions(cachedActions);
  } else if (filter === "MODIFIED") {
    renderActions(cachedActions.filter(a => a.state === "MODIFIED"));
  } else {
    renderActions(cachedActions.filter(a => a.urgency === filter));
  }
}

function renderExpertQueue(items) {
  const container = document.getElementById("expert-items-container");
  document.getElementById("badge-expert-count").textContent = items.length;

  if (!items.length) {
    container.innerHTML = '<div class="empty-state">No ambiguous changes pending review. All high/medium confidence.</div>';
    return;
  }

  container.innerHTML = items.map((item, idx) => {
    const targetId = item.mapping ? item.mapping.id : item.change.id;
    return `
      <div class="expert-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="badge badge-low">LOW CONFIDENCE — ESCALATED</span>
          <span style="font-family:var(--font-mono); font-size:0.75rem; color:#fca5a5;">Target: ${targetId}</span>
        </div>
        <div class="signals-list">
          ${item.signals.map(s => `<span class="signal-chip">${escapeHtml(s)}</span>`).join("")}
        </div>
        <div style="font-size:0.9rem; color:#f3f4f6;">
          <strong>Change Excerpt:</strong> ${escapeHtml(item.change.description)}
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.08); padding-top:0.75rem; display:flex; gap:0.5rem; justify-content:flex-end;">
          <button class="btn btn-primary btn-sm" onclick="resolveExpertItem('${targetId}', 'CONFIRMED_APPLICABLE')">Confirm Applicable</button>
          <button class="btn btn-secondary btn-sm" onclick="resolveExpertItem('${targetId}', 'DISMISS_NON_APPLICABLE')">Dismiss as Exempt</button>
        </div>
      </div>
    `;
  }).join("");
}

async function resolveExpertItem(targetId, decision) {
  const rationale = prompt(`Enter legal counsel rationale for ${decision}:`, "Verified against facility operational classification.");
  if (!rationale) return;

  try {
    const res = await fetch(`/expert_review/${targetId}/resolve?reviewer_id=u_counsel&decision=${decision}&rationale=${encodeURIComponent(rationale)}`, {
      method: "POST"
    });
    if (!res.ok) throw new Error(await res.text());
    alert(`Item ${targetId} resolved successfully. Immutable audit event logged.`);
    // Re-run analysis or reload data
    runAnalysis();
  } catch (err) {
    alert("Resolution error: " + err);
  }
}

// Human Override Modal Flow
function openOverrideModal(actionId) {
  const action = cachedActions.find(a => a.id === actionId);
  if (!action) return;

  targetOverrideActionId = actionId;
  document.getElementById("modal-original-text").textContent = action.recommended_action;
  document.getElementById("override-text-input").value = action.recommended_action;
  document.getElementById("override-rationale-input").value = "";

  document.getElementById("override-modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("override-modal").classList.add("hidden");
  targetOverrideActionId = null;
}

async function commitHumanOverride() {
  const text = document.getElementById("override-text-input").value.trim();
  const rationale = document.getElementById("override-rationale-input").value.trim();

  if (!text || !rationale) {
    alert("Please provide both modified directive and mandatory rationale.");
    return;
  }

  try {
    const res = await fetch(`/actions/${targetOverrideActionId}/override?user_id=u_reviewer&updated_text=${encodeURIComponent(text)}&rationale=${encodeURIComponent(rationale)}`, {
      method: "POST"
    });
    if (!res.ok) throw new Error(await res.text());

    closeModal();
    alert("Human override successfully recorded. Original system recommendation preserved in event store.");
    
    // Refresh actions and audit dossier
    const actRes = await fetch("/actions");
    cachedActions = await actRes.json();
    renderActions(cachedActions);
    loadAuditDossier(document.getElementById("audit-stream-input").value);
  } catch (err) {
    alert("Failed to commit override: " + err);
  }
}

// Living Audit Dossier Flow
async function loadAuditDossier(streamId) {
  const container = document.getElementById("audit-dossier-container");
  container.innerHTML = '<div class="loading-spinner">Reconstructing living audit timeline from event store...</div>';

  try {
    const res = await fetch(`/audit/${encodeURIComponent(streamId)}`);
    const dossier = await res.json();

    if (!dossier.reconstructed_timeline || !dossier.reconstructed_timeline.length) {
      container.innerHTML = `<div class="empty-state">No audit events recorded for stream '${streamId}'.</div>`;
      return;
    }

    container.innerHTML = `
      <div style="padding:1.25rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
          <div>
            <h3>Living Compliance Timeline</h3>
            <span style="font-size:0.8rem; color:#9ca3af; font-family:var(--font-mono);">Stream: ${streamId}</span>
          </div>
          <span class="badge badge-final">${dossier.total_events} Immutable Events Reconstructed</span>
        </div>
        <div class="timeline-stream">
          ${dossier.reconstructed_timeline.map(evt => `
            <div class="timeline-node">
              <div class="timeline-dot"></div>
              <div class="timeline-content">
                <div class="timeline-time">${evt.timestamp}</div>
                <div class="timeline-actor">${evt.actor} → <span style="color:#f3f4f6;">${evt.event_type}</span></div>
                <div class="timeline-summary">${escapeHtml(evt.summary)}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state" style="color:#f87171;">Failed to load audit dossier: ${err}</div>`;
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
