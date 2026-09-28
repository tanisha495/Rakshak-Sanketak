(function () {
    const services = window.SanketakServices;

    const navItems = [
        { key: "dashboard", label: "Dashboard", href: "dash.html", icon: "⌂" },
        { key: "triage", label: "Triage Inbox", href: "index.html", icon: "▤" },
        { key: "risk", label: "Risk Radar", href: "risk-radar.html", icon: "◎" },
        { key: "patterns", label: "Patterns", href: "patterns.html", icon: "◇" },
        { key: "actions", label: "Corrective Actions", href: "corrective-actions.html", icon: "☑" },
        { key: "settings", label: "Settings", href: "settings.html", icon: "⚙" }
    ];

    const pageCopy = {
        dashboard: {
            title: "Dashboard",
            subtitle: "What needs HSE attention right now?"
        },
        triage: {
            title: "Triage Inbox",
            subtitle: "Review and prioritise incoming worker safety reports."
        },
        report: {
            title: "Report Intelligence",
            subtitle: "Review the SIF fingerprint, evidence and HSE assessment for this report."
        },
        risk: {
            title: "Risk Radar",
            subtitle: "Where are precursor signals accumulating?"
        },
        patterns: {
            title: "Recurring Precursor Patterns",
            subtitle: "Identify repeated combinations of hazards, exposures and barrier failures."
        },
        actions: {
            title: "Corrective Actions",
            subtitle: "Track assigned safety actions through HSE verification."
        },
        settings: {
            title: "Settings",
            subtitle: "Configure HSE monitoring preferences for Sanketak."
        },
        pdf: {
            title: "PDF Export",
            subtitle: "Print or export Report Intelligence summaries from the browser."
        }
    };

    async function init() {
        const root = document.getElementById("app");
        const page = root.dataset.page;
        const copy = pageCopy[page] || pageCopy.dashboard;

        root.innerHTML = `
            <aside class="sidebar">
                <a class="brand" href="dash.html" aria-label="Sanketak dashboard">
                    <span class="brand-mark">✦</span>
                    <span>
                        <strong>SANKETAK</strong>
                        <small>HSE Intelligence</small>
                    </span>
                </a>
                <nav class="sidebar-nav">
                    ${navItems.map(function (item) {
                        return `
                            <a class="${item.key === page ? "active" : ""}" href="${item.href}">
                                <span class="nav-icon">${item.icon}</span>
                                ${item.label}
                            </a>
                        `;
                    }).join("")}
                </nav>
                <div class="system-card">
                    <span class="status-dot"></span>
                    <div>
                        <strong>Supabase connected</strong>
                        <small>Realtime worker reports</small>
                    </div>
                </div>
            </aside>
            <main class="main">
                <header class="topbar">
                    <div class="topbar-status">
                        <span class="status-dot"></span>
                        HSE Command Centre
                    </div>
                    <div class="topbar-actions">
                        <div class="live-pill">
                            <span class="status-dot"></span>
                            Live Monitoring
                        </div>
                        <button class="notification-button" type="button" aria-label="Notifications">♧</button>
                        <div class="user-chip">
                            <span class="avatar">H</span>
                            <span>
                                <strong>HSE Admin</strong>
                                <small>Human reviewer</small>
                            </span>
                        </div>
                    </div>
                </header>
                <section class="page">
                    <div class="page-heading">
                        <div>
                            <span class="eyebrow">Sanketak • HSE Monitoring</span>
                            <h1>${copy.title}</h1>
                            <p>${copy.subtitle}</p>
                        </div>
                        <div class="hero-message">
                            <span>${heroMessage(page)}</span>
                            <strong>♧</strong>
                        </div>
                    </div>
                    <div id="pageContent"></div>
                </section>
            </main>
        `;

        const content = document.getElementById("pageContent");
        content.innerHTML = loadingPanel();

        let state;

        try {
            state = await services.initialize(function () {
                renderCurrentPage(page, content);
            });
        } catch (error) {
            content.innerHTML = connectionPanel({
                error: error.message,
                tableErrors: {}
            });
            return;
        }

        if (!state.configured || state.error) {
            content.innerHTML = connectionPanel(state);
            return;
        }

        renderCurrentPage(page, content);
    }

    function renderCurrentPage(page, content) {
        if (page === "dashboard") {
            renderDashboard(content);
        } else if (page === "triage") {
            renderTriage(content);
        } else if (page === "report") {
            renderReport(content);
        } else if (page === "risk") {
            renderRiskRadar(content);
        } else if (page === "patterns") {
            renderPatterns(content);
        } else if (page === "actions") {
            renderActions(content);
        } else if (page === "settings") {
            renderSettings(content);
        } else if (page === "pdf") {
            renderPdfExport(content);
        }
    }

    function renderDashboard(content) {
        const summary = services.getDashboardSummary();
        const priorityReports = services.getPriorityReports(5);
        const drift = services.getBarrierDriftConcerns();
        const siteOverview = services.getSiteOverview();

        content.innerHTML = `
            ${connectionNotice()}
            <div class="kpi-grid five">
                ${kpiCard("Reports Received", summary.reportsReceived, "Worker safety reports from Supabase", "info")}
                ${kpiCard("Needs Review", summary.needsReview, "Submitted reports awaiting HSE triage", "warn")}
                ${kpiCard("High SIF Potential", summary.highSifPotential, "Reports with high SIF potential", "danger")}
                ${kpiCard("Open Corrective Actions", summary.openCorrectiveActions, "Actions not yet HSE verified", "warn")}
                ${kpiCard("Critical Reports", summary.criticalReports, "Priority reports for immediate attention", "danger")}
            </div>

            <section class="panel">
                <div class="panel-header">
                    <div>
                        <h2>Priority Reports</h2>
                        <p>Top reports sorted by priority and newest received time.</p>
                    </div>
                    <a class="text-link" href="index.html">Open Triage Inbox</a>
                </div>
                ${reportTable(priorityReports, true)}
            </section>

            <div class="two-column">
                <section class="panel">
                    <div class="panel-header">
                        <div>
                            <h2>Barrier Drift / Emerging Concerns</h2>
                            <p>Repeated weakening of controls across recent reports.</p>
                        </div>
                    </div>
                    <div class="stack">
                        ${drift.map(driftCard).join("")}
                    </div>
                </section>

                <section class="panel">
                    <div class="panel-header">
                        <div>
                            <h2>Site Risk Overview</h2>
                            <p>Site and area safety intelligence from current Supabase reports.</p>
                        </div>
                    </div>
                    <div class="site-grid">
                        ${siteOverview.map(function (site) {
                            return `
                                <article class="site-card">
                                    <h3>${esc(site.site)}</h3>
                                    <div class="metric-row"><span>Reports</span><strong>${site.reports}</strong></div>
                                    <div class="metric-row"><span>High SIF</span><strong>${site.highSif}</strong></div>
                                    <div class="tag-row"><span class="tag info">${esc(site.dominantIssue)}</span></div>
                                </article>
                            `;
                        }).join("")}
                    </div>
                </section>
            </div>

            <section class="panel">
                <div class="panel-header">
                    <div>
                        <h2>Recent HSE Activity</h2>
                        <p>Lifecycle events from reports, reviews, actions and barrier warnings.</p>
                    </div>
                </div>
                <div class="activity-list">
                    ${services.getRecentActivity().map(activityItem).join("") || emptyState("No recent HSE activity is available yet.")}
                </div>
            </section>
        `;
    }

    function renderTriage(content) {
        const reports = services.getReports();
        const sites = unique(reports.map(function (report) { return report.site; }));
        const rules = unique(reports.flatMap(function (report) { return report.analysis.lifeSavingRules; }));
        const barriers = unique(reports.map(function (report) { return report.analysis.barrierFailure; }));
        const summary = services.getDashboardSummary();

        content.innerHTML = `
            ${connectionNotice()}
            <div class="kpi-grid four">
                ${kpiCard("Needs Review", summary.needsReview, "Submitted reports requiring triage", "warn")}
                ${kpiCard("Critical", summary.criticalReports, "Critical priority reports", "danger")}
                ${kpiCard("High SIF Potential", summary.highSifPotential, "High SIF potential reports", "danger")}
                ${kpiCard("Actions Pending", summary.openCorrectiveActions, "Corrective actions not verified", "warn")}
            </div>

            <section class="panel">
                <div class="filter-grid">
                    <label>
                        Search
                        <input id="searchFilter" type="search" placeholder="Report ID, text or site">
                    </label>
                    <label>
                        Review Status
                        <select id="statusFilter">${optionList(["all", "submitted", "under_review", "action_assigned", "action_taken", "verified", "not_set"], services.lifecycleStatus)}</select>
                    </label>
                    <label>
                        Priority
                        <select id="priorityFilter">${optionList(["all", "critical", "high", "medium", "low"])}</select>
                    </label>
                    <label>
                        SIF Potential
                        <select id="sifFilter">${optionList(["all", "high", "medium", "low"])}</select>
                    </label>
                    <label>
                        Site
                        <select id="siteFilter">${optionList(["all"].concat(sites))}</select>
                    </label>
                    <label>
                        Life-Saving Rule
                        <select id="ruleFilter">${optionList(["all"].concat(rules))}</select>
                    </label>
                    <label>
                        Barrier Failure
                        <select id="barrierFilter">${optionList(["all"].concat(barriers))}</select>
                    </label>
                    <label>
                        Date Range
                        <select id="dateFilter">${optionList(["all", "24h", "7d"])}</select>
                    </label>
                </div>
            </section>

            <section class="panel">
                <div class="panel-header">
                    <div>
                        <h2>Incoming Worker Reports</h2>
                        <p>Default sorting: Critical, High, Medium, Low, then newest first.</p>
                    </div>
                </div>
                <div id="triageTable"></div>
            </section>
        `;

        const filterIds = [
            "searchFilter",
            "statusFilter",
            "priorityFilter",
            "sifFilter",
            "siteFilter",
            "ruleFilter",
            "barrierFilter",
            "dateFilter"
        ];

        filterIds.forEach(function (id) {
            document.getElementById(id).addEventListener("input", renderFilteredReports);
        });

        renderFilteredReports();

        function renderFilteredReports() {
            const filtered = reports.filter(function (report) {
                const search = document.getElementById("searchFilter").value.toLowerCase().trim();
                const haystack = [
                    report.trackingToken,
                    report.description,
                    report.site,
                    report.area,
                    report.analysis.barrierFailure,
                    report.analysis.lifeSavingRules.join(" ")
                ].join(" ").toLowerCase();

                return (!search || haystack.includes(search))
                    && filterMatches("statusFilter", report.status)
                    && filterMatches("priorityFilter", report.priority)
                    && filterMatches("sifFilter", report.sifPotential)
                    && filterMatches("siteFilter", report.site)
                    && filterMatches("ruleFilter", report.analysis.lifeSavingRules)
                    && filterMatches("barrierFilter", report.analysis.barrierFailure)
                    && dateMatches(document.getElementById("dateFilter").value, report.receivedAt);
            });

            document.getElementById("triageTable").innerHTML = reportTable(filtered, true);
        }
    }

    function renderReport(content) {
        const params = new URLSearchParams(window.location.search);
        const report = services.getReportById(params.get("id"));

        if (!report) {
            content.innerHTML = `
                ${connectionNotice()}
                ${emptyState("No report is available from Supabase yet. Once workers submit reports from the mobile app, they will appear here.")}
            `;
            return;
        }

        const related = report.relatedSignals.map(function (id) {
            return services.getReportById(id);
        }).filter(Boolean);

        content.innerHTML = `
            ${connectionNotice()}
            <a class="back-link" href="index.html">Back to Triage Inbox</a>

            <section class="report-hero">
                <div>
                    <span class="eyebrow">Tracking ID</span>
                    <h2>${esc(report.trackingToken)}</h2>
                    <p>${esc(report.description)}</p>
                    <div class="meta-grid">
                        ${meta("Site / Area", report.site + " / " + report.area)}
                        ${meta("Submitted", relativeTime(report.receivedAt))}
                        ${meta("Reporting Method", report.reportingMethod)}
                        ${meta("Language", report.reportLanguage)}
                        <div>
                            <span>Workflow Status</span>
                            <strong id="workflowStatus">${statusLabel(report.status)}</strong>
                        </div>
                    </div>
                </div>
                <div class="score-grid">
                    ${scoreCard("Priority", cap(report.priority), report.priority)}
                    ${scoreCard("SIF Potential", cap(report.sifPotential), report.sifPotential)}
                    ${scoreCard("Model Confidence", confidenceLabel(report.modelConfidence), "info")}
                </div>
            </section>

            <div class="report-layout">
                <section class="panel">
                    <div class="panel-header">
                        <div>
                            <h2>Original Worker Report</h2>
                            <p>Anonymous worker report. No personal identity fields are required.</p>
                        </div>
                    </div>
                    <blockquote class="worker-report">${esc(report.originalReport)}</blockquote>
                    ${report.reportingMethod === "Voice" ? "<button class=\"secondary-button\" type=\"button\">Play Original Recording</button>" : ""}
                </section>

                <section class="panel rule-card">
                    <span class="eyebrow">Life-Saving Rule</span>
                    <h2>${esc(report.analysis.lifeSavingRules.join(" / "))}</h2>
                    <p>${lifeSavingRuleText(report.analysis.lifeSavingRules[0])}</p>
                </section>
            </div>

            <section class="panel strong-section">
                <div class="panel-header">
                    <div>
                        <h2>SIF Fingerprint</h2>
                        <p>Structured activity-to-consequence chain extracted from the worker report.</p>
                    </div>
                </div>
                <div class="fingerprint">
                    ${fingerprintStep("Activity", report.analysis.activity)}
                    ${fingerprintStep("Hazard", report.analysis.hazard)}
                    ${fingerprintStep("Exposure", report.analysis.exposure)}
                    ${fingerprintStep("Barrier Failure", report.analysis.barrierFailure)}
                    ${fingerprintStep("Potential Consequence", report.analysis.potentialConsequence)}
                    ${fingerprintStep("Life-Saving Rule", report.analysis.lifeSavingRules.join(" / "))}
                </div>
            </section>

            <section class="panel">
                <div class="panel-header">
                    <div>
                        <h2>Barrier Assessment</h2>
                        <p>Control status for HSE review before the report moves forward in workflow.</p>
                    </div>
                </div>
                <div class="metric-grid">
                    ${miniMetric("Primary Barrier", report.analysis.barrierFailure)}
                    ${miniMetric("Observed Condition", report.priority === "critical" ? "Immediate verification required" : "Field verification required")}
                    ${miniMetric("Life-Saving Rule", report.analysis.lifeSavingRules.join(" / "))}
                    ${miniMetric("Recommended Owner", report.site + " HSE Lead")}
                </div>
            </section>

            <section class="panel">
                <div class="panel-header">
                    <div>
                        <h2>Why Sanketak Flagged This</h2>
                        <p>Evidence extracted from the report and mapped to HSE taxonomy.</p>
                    </div>
                </div>
                <div class="evidence-grid">
                    ${report.evidence.map(function (item) {
                        return `
                            <article class="evidence-card">
                                <q>${esc(item.text)}</q>
                                <div class="mapped-row">
                                    <span class="tag info">${esc(item.type)}</span>
                                    <strong>${esc(item.interpretation)}</strong>
                                </div>
                            </article>
                        `;
                    }).join("")}
                </div>
            </section>

            <div class="two-column">
                <section class="panel">
                    <div class="panel-header">
                        <div>
                            <h2>Related Safety Signals</h2>
                            <p>${related.length} related reports found from similar precursor patterns.</p>
                        </div>
                    </div>
                    <div class="stack">
                        ${related.map(function (item) {
                            return `
                                <a class="signal-row" href="report.html?id=${encodeURIComponent(item.trackingToken)}">
                                    <strong>${esc(item.trackingToken)}</strong>
                                    <span>${esc(item.site)} / ${esc(item.area)}</span>
                                    <span>${esc(item.analysis.barrierFailure)}</span>
                                    <small>${relativeTime(item.receivedAt)}</small>
                                </a>
                            `;
                        }).join("") || "<p class=\"muted\">No related signals are available for this report yet.</p>"}
                    </div>
                </section>

                <section class="panel">
                    <div class="panel-header">
                        <div>
                            <h2>Barrier Drift</h2>
                            <p>Repeated weakening or failure of a control, not accident prediction.</p>
                        </div>
                    </div>
                    ${driftCard(report.barrierDrift)}
                </section>
            </div>

            <section class="panel">
                <div class="panel-header">
                    <div>
                        <h2>Precedent Engine</h2>
                        <p>Historical similarity supports investigation and does not predict that an incident will occur.</p>
                    </div>
                </div>
                <div class="precedent-grid">
                    ${report.precedents.map(function (precedent) {
                        return `
                            <article class="precedent-card">
                                <div class="similarity">${Math.round(precedent.similarityScore * 100)}% Similarity</div>
                                <h3>${esc(precedent.title)}</h3>
                                <p>${esc(precedent.year)} - ${esc(precedent.source)}</p>
                                <strong>Matching factors</strong>
                                <ul>${precedent.matchingFactors.map(function (factor) {
                                    return `<li>${esc(factor)}</li>`;
                                }).join("")}</ul>
                                <strong>Key lesson</strong>
                                <p>${esc(precedent.keyLesson)}</p>
                            </article>
                        `;
                    }).join("") || "<p class=\"muted\">No historical precedent is attached to this report yet.</p>"}
                </div>
            </section>

            <div class="two-column">
                <section class="panel">
                    <div class="panel-header">
                        <div>
                            <h2>HSE Assessment</h2>
                            <p>AI-assisted prioritisation. Final safety assessment remains with HSE.</p>
                        </div>
                    </div>
                    <div class="form-grid">
                        <label>SIF assessment
                            <select>
                                <option>Confirm High SIF Potential</option>
                                <option>Change to Medium</option>
                                <option>Change to Low</option>
                                <option>Not SIF</option>
                            </select>
                        </label>
                        <label>Priority
                            <select>
                                <option ${report.priority === "critical" ? "selected" : ""}>Critical</option>
                                <option ${report.priority === "high" ? "selected" : ""}>High</option>
                                <option ${report.priority === "medium" ? "selected" : ""}>Medium</option>
                                <option ${report.priority === "low" ? "selected" : ""}>Low</option>
                            </select>
                        </label>
                        <label>Correct barrier failure
                            <input value="${esc(report.analysis.barrierFailure)}">
                        </label>
                        <label>Correct Life-Saving Rule
                            <input value="${esc(report.analysis.lifeSavingRules.join(" / "))}">
                        </label>
                        <label class="wide">Add HSE note
                            <textarea placeholder="Add reviewer observation or field verification note"></textarea>
                        </label>
                    </div>
                </section>

                <section class="panel">
                    <div class="panel-header">
                        <div>
                            <h2>Recommended Actions</h2>
                            <p>Suggested by Sanketak. HSE owns assignment and verification.</p>
                        </div>
                    </div>
                    <ul class="suggestion-list">
                        ${recommendedActions(report).map(function (action) {
                            return `<li>${esc(action)}</li>`;
                        }).join("")}
                    </ul>
                    <form id="assignActionForm" class="form-grid compact">
                        <label class="wide">Action description
                            <textarea name="description" required>Verify ${esc(report.analysis.barrierFailure.toLowerCase())} before work resumes.</textarea>
                        </label>
                        <label>Assign to
                            <input name="assignedTo" required value="Site HSE Lead">
                        </label>
                        <label>Due date
                            <input name="dueDate" type="date" required value="${tomorrowDate()}">
                        </label>
                        <label>Priority
                            <select name="priority">
                                <option>Critical</option>
                                <option>High</option>
                                <option>Medium</option>
                                <option>Low</option>
                            </select>
                        </label>
                        <label class="checkbox-row">
                            <input name="verificationRequired" type="checkbox" checked>
                            Verification required
                        </label>
                        <button class="primary-button wide" type="submit">Assign Action</button>
                        <p id="assignmentStatus" class="assignment-status"></p>
                    </form>
                </section>
            </div>

            <div class="footer-actions">
                <button class="secondary-button" type="button" id="printButton">Print / Export PDF</button>
                <a class="primary-button" href="corrective-actions.html">Open Corrective Actions</a>
            </div>
        `;

        document.getElementById("printButton").addEventListener("click", function () {
            window.print();
        });

        document.getElementById("assignActionForm").addEventListener("submit", async function (event) {
            event.preventDefault();
            const status = document.getElementById("assignmentStatus");
            const formData = new FormData(event.currentTarget);

            status.textContent = "Saving corrective action to Supabase...";

            try {
                await services.assignCorrectiveAction(report, {
                    description: formData.get("description"),
                    assignedTo: formData.get("assignedTo"),
                    dueDate: formData.get("dueDate"),
                    priority: formData.get("priority"),
                    verificationRequired: formData.has("verificationRequired")
                });

                status.textContent = "Action assigned in Supabase.";
                document.getElementById("workflowStatus").textContent = "Action Assigned";
            } catch (error) {
                status.textContent = "Could not save action: " + error.message;
            }
        });
    }

    function renderRiskRadar(content) {
        const radar = services.getRiskRadar();
        const reports = services.getReports();

        content.innerHTML = `
            ${connectionNotice()}
            <section class="panel">
                <div class="filter-grid">
                    ${filterSelect("radarSite", "Site", ["all"].concat(unique(reports.map(function (report) { return report.site; }))))}
                    ${filterSelect("radarArea", "Area", ["all"].concat(unique(reports.map(function (report) { return report.area; }))))}
                    ${filterSelect("radarDate", "Date Range", ["all", "24h", "7d"])}
                    ${filterSelect("radarSif", "SIF Potential", ["all", "high", "medium", "low"])}
                    ${filterSelect("radarHazard", "Hazard", ["all"].concat(unique(reports.map(function (report) { return report.analysis.hazard; }))))}
                    ${filterSelect("radarBarrier", "Barrier Failure", ["all"].concat(unique(reports.map(function (report) { return report.analysis.barrierFailure; }))))}
                    ${filterSelect("radarRule", "Life-Saving Rule", ["all"].concat(unique(reports.flatMap(function (report) { return report.analysis.lifeSavingRules; }))))}
                </div>
            </section>
            <section class="panel">
                <div class="panel-header">
                    <div>
                        <h2>Ranked Site / Area Signals</h2>
                        <p>Accumulation view by site, area, SIF potential, hazard and barrier failure.</p>
                    </div>
                </div>
                <div id="radarList"></div>
            </section>
        `;

        ["radarSite", "radarArea", "radarDate", "radarSif", "radarHazard", "radarBarrier", "radarRule"].forEach(function (id) {
            document.getElementById(id).addEventListener("input", renderRadar);
        });

        renderRadar();

        function renderRadar() {
            const filteredReports = reports.filter(function (report) {
                return filterMatches("radarSite", report.site)
                    && filterMatches("radarArea", report.area)
                    && filterMatches("radarSif", report.sifPotential)
                    && filterMatches("radarHazard", report.analysis.hazard)
                    && filterMatches("radarBarrier", report.analysis.barrierFailure)
                    && filterMatches("radarRule", report.analysis.lifeSavingRules)
                    && dateMatches(document.getElementById("radarDate").value, report.receivedAt);
            });
            const allowed = new Set(filteredReports.map(function (report) {
                return report.site + "|" + report.area;
            }));
            const filteredRadar = radar.filter(function (entry) {
                return allowed.has(entry.site + "|" + entry.area);
            });

            document.getElementById("radarList").innerHTML = `
                <div class="responsive-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Site</th>
                                <th>Area</th>
                                <th>Reports</th>
                                <th>High SIF</th>
                                <th>Dominant Hazard</th>
                                <th>Dominant Barrier Failure</th>
                                <th>Trend</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredRadar.map(function (entry) {
                                return `
                                    <tr>
                                        <td>${esc(entry.site)}</td>
                                        <td>${esc(entry.area)}</td>
                                        <td>${entry.reportCount}</td>
                                        <td>${entry.highSifCount}</td>
                                        <td>${esc(entry.dominantHazard)}</td>
                                        <td>${esc(entry.dominantBarrierFailure)}</td>
                                        <td><span class="tag ${entry.trend === "Increasing" ? "warn" : "info"}">${trendLabel(entry.trend)}</span></td>
                                        <td><a class="text-link" href="index.html">View reports</a></td>
                                    </tr>
                                `;
                            }).join("")}
                        </tbody>
                    </table>
                </div>
            `;
        }
    }

    function renderPatterns(content) {
        const patterns = services.getPatterns();
        const reports = services.getReports();

        content.innerHTML = `
            ${connectionNotice()}
            <section class="panel">
                <div class="filter-grid">
                    ${filterSelect("patternSite", "Site", ["all"].concat(unique(reports.map(function (report) { return report.site; }))))}
                    ${filterSelect("patternActivity", "Activity", ["all"].concat(unique(reports.map(function (report) { return report.analysis.activity; }))))}
                    ${filterSelect("patternHazard", "Hazard", ["all"].concat(unique(reports.map(function (report) { return report.analysis.hazard; }))))}
                    ${filterSelect("patternBarrier", "Barrier", ["all"].concat(unique(reports.map(function (report) { return report.analysis.barrierFailure; }))))}
                    ${filterSelect("patternRule", "Life-Saving Rule", ["all"].concat(unique(reports.flatMap(function (report) { return report.analysis.lifeSavingRules; }))))}
                    ${filterSelect("patternDate", "Date Range", ["all", "24h", "7d"])}
                </div>
            </section>
            <section class="pattern-grid" id="patternGrid"></section>
        `;

        ["patternSite", "patternActivity", "patternHazard", "patternBarrier", "patternRule", "patternDate"].forEach(function (id) {
            document.getElementById(id).addEventListener("input", renderPatternCards);
        });

        renderPatternCards();

        function renderPatternCards() {
            const filteredReports = reports.filter(function (report) {
                return filterMatches("patternSite", report.site)
                    && filterMatches("patternActivity", report.analysis.activity)
                    && filterMatches("patternHazard", report.analysis.hazard)
                    && filterMatches("patternBarrier", report.analysis.barrierFailure)
                    && filterMatches("patternRule", report.analysis.lifeSavingRules)
                    && dateMatches(document.getElementById("patternDate").value, report.receivedAt);
            });
            const allowedTokens = new Set(filteredReports.map(function (report) { return report.trackingToken; }));
            const filteredPatterns = patterns.filter(function (pattern) {
                return pattern.affectedReports.some(function (token) {
                    return allowedTokens.has(token);
                });
            });

            document.getElementById("patternGrid").innerHTML = filteredPatterns.map(function (pattern) {
                return `
                    <article class="pattern-card">
                        <span class="eyebrow">Pattern</span>
                        <h2>${esc(pattern.pattern)}</h2>
                        <div class="metric-grid">
                            ${miniMetric("Reports", pattern.reports)}
                            ${miniMetric("High SIF", pattern.highSif)}
                            ${miniMetric("Primary Site", pattern.primarySite)}
                            ${miniMetric("Trend", trendLabel(pattern.trend))}
                        </div>
                        <div class="tag-row">
                            <span class="tag info">${esc(pattern.lifeSavingRule)}</span>
                        </div>
                        <p class="muted">Affected reports: ${pattern.affectedReports.map(esc).join(", ")}</p>
                    </article>
                `;
            }).join("");
        }
    }

    function renderActions(content) {
        const actions = services.getActions();
        const now = new Date();
        const openCount = actions.filter(function (action) { return action.status === "open"; }).length;
        const progressCount = actions.filter(function (action) { return action.status === "in_progress"; }).length;
        const actionTakenCount = actions.filter(function (action) { return action.status === "action_taken"; }).length;
        const overdueCount = actions.filter(function (action) {
            return action.status !== "verified" && new Date(action.dueDate + "T23:59:59") < now;
        }).length;
        const verifiedCount = actions.filter(function (action) { return action.status === "verified"; }).length;

        content.innerHTML = `
            ${connectionNotice()}
            <div class="kpi-grid five">
                ${kpiCard("Open", openCount, "Assigned but not started", "warn")}
                ${kpiCard("In Progress", progressCount, "Currently being acted on", "info")}
                ${kpiCard("Action Taken", actionTakenCount, "Awaiting HSE verification", "warn")}
                ${kpiCard("Overdue", overdueCount, "Due date has passed", "danger")}
                ${kpiCard("Verified", verifiedCount, "Final HSE verification complete", "success")}
            </div>
            <section class="panel">
                <div class="panel-header">
                    <div>
                        <h2>Corrective Action Register</h2>
                        <p>Actions progress from Open to In Progress to Action Taken to Verified.</p>
                    </div>
                </div>
                <div class="responsive-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Report</th>
                                <th>Action</th>
                                <th>Site</th>
                                <th>Assigned To</th>
                                <th>Priority</th>
                                <th>Due Date</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${actions.map(function (action) {
                                const isOverdue = action.status !== "verified" && new Date(action.dueDate + "T23:59:59") < now;
                                return `
                                    <tr>
                                        <td><strong>${esc(action.trackingToken)}</strong></td>
                                        <td>${esc(action.description)}</td>
                                        <td>${esc(action.site)} / ${esc(action.area)}</td>
                                        <td>${esc(action.assignedTo)}</td>
                                        <td><span class="tag ${priorityClass(action.priority)}">${cap(action.priority)}</span></td>
                                        <td>${formatDate(action.dueDate)}</td>
                                        <td><span class="tag ${isOverdue ? "danger" : statusClass(action.status)}">${isOverdue ? "Overdue" : services.actionStatus[action.status]}</span></td>
                                        <td><a class="text-link" href="report.html?id=${encodeURIComponent(action.trackingToken)}">View report</a></td>
                                    </tr>
                                `;
                            }).join("")}
                        </tbody>
                    </table>
                </div>
            </section>
        `;
    }

    function renderSettings(content) {
        content.innerHTML = `
            ${connectionNotice()}
            <section class="panel narrow-panel">
                <div class="panel-header">
                    <div>
                        <h2>Safety Alerts</h2>
                        <p>Dashboard settings shown in the browser. Persist these in Supabase when a settings table is added.</p>
                    </div>
                </div>
                ${settingRow("High SIF potential alerts", "Notify HSE when submitted reports contain high SIF potential.", true)}
                ${settingRow("Barrier drift warnings", "Highlight repeated weakening of the same safety barrier.", true)}
                ${settingRow("Corrective action reminders", "Remind owners before due dates and after action taken.", true)}
                ${settingRow("Weekly pattern summary", "Summarise recurring precursor patterns by site.", false)}
            </section>
            <section class="panel narrow-panel">
                <div class="panel-header">
                    <div>
                        <h2>Account</h2>
                        <p>End this dashboard session on the current browser.</p>
                    </div>
                </div>
                <button class="danger-button" type="button" id="logoutButton">Logout</button>
                <p id="logoutStatus" class="assignment-status"></p>
            </section>
        `;

        document.getElementById("logoutButton").addEventListener("click", async function () {
            const status = document.getElementById("logoutStatus");
            const button = document.getElementById("logoutButton");

            button.disabled = true;
            status.textContent = "Logging out...";

            try {
                await services.signOut();
                window.location.href = "login.html";
            } catch (error) {
                button.disabled = false;
                status.textContent = "Could not logout: " + error.message;
            }
        });
    }

    function renderPdfExport(content) {
        const reports = services.getReports();

        if (!reports.length) {
            content.innerHTML = `
                ${connectionNotice()}
                ${emptyState("No Supabase reports are available to export yet.")}
            `;
            return;
        }

        content.innerHTML = `
            ${connectionNotice()}
            <section class="panel narrow-panel">
                <div class="panel-header">
                    <div>
                        <h2>Report Intelligence Export</h2>
                        <p>PDF generation is kept out of primary navigation. Use browser print on a report intelligence page.</p>
                    </div>
                </div>
                <label>Select report
                    <select id="exportReport">
                        ${reports.map(function (report) {
                            return `<option value="${esc(report.trackingToken)}">${esc(report.trackingToken)} - ${esc(report.description)}</option>`;
                        }).join("")}
                    </select>
                </label>
                <div class="footer-actions">
                    <a class="primary-button" id="openExportReport" href="report.html?id=${encodeURIComponent(reports[0].trackingToken)}">Open Report Intelligence</a>
                </div>
            </section>
        `;

        document.getElementById("exportReport").addEventListener("input", function (event) {
            document.getElementById("openExportReport").href = "report.html?id=" + encodeURIComponent(event.target.value);
        });
    }

    function reportTable(reports, includeAction) {
        return `
            <div class="responsive-table">
                <table>
                    <thead>
                        <tr>
                            <th>Priority</th>
                            <th>Tracking ID</th>
                            <th>Report</th>
                            <th>Site / Area</th>
                            <th>SIF Potential</th>
                            <th>Barrier Failure</th>
                            <th>Life-Saving Rule</th>
                            <th>Received</th>
                            <th>Status</th>
                            ${includeAction ? "<th>Action</th>" : ""}
                        </tr>
                    </thead>
                    <tbody>
                        ${reports.map(function (report) {
                            return `
                                <tr class="clickable-row" data-href="report.html?id=${encodeURIComponent(report.trackingToken)}">
                                    <td><span class="tag ${priorityClass(report.priority)}">${cap(report.priority)}</span></td>
                                    <td><strong>${esc(report.trackingToken)}</strong></td>
                                    <td>${esc(report.description)}</td>
                                    <td>${esc(report.site)} / ${esc(report.area)}</td>
                                    <td><span class="tag ${priorityClass(report.sifPotential)}">${cap(report.sifPotential)}</span></td>
                                    <td>${esc(report.analysis.barrierFailure)}</td>
                                    <td>${esc(report.analysis.lifeSavingRules.join(" / "))}</td>
                                    <td>${dateTimeLabel(report.receivedAt)}</td>
                                    <td><span class="tag ${statusClass(report.status)}">${statusLabel(report.status)}</span></td>
                                    ${includeAction ? `<td><a class="text-link" href="report.html?id=${encodeURIComponent(report.trackingToken)}">View -></a></td>` : ""}
                                </tr>
                            `;
                        }).join("") || `<tr><td colspan="${includeAction ? 10 : 9}">No reports match the current filters.</td></tr>`}
                    </tbody>
                </table>
            </div>
        `;
    }

    document.addEventListener("click", function (event) {
        const row = event.target.closest(".clickable-row");

        if (row && !event.target.closest("a, button, input, select, textarea")) {
            window.location.href = row.dataset.href;
        }
    });

    function loadingPanel() {
        return `
            <section class="panel">
                <div class="panel-header">
                    <div>
                        <h2>Connecting to Supabase</h2>
                        <p>Loading worker safety reports and opening realtime subscriptions.</p>
                    </div>
                </div>
            </section>
        `;
    }

    function connectionPanel(state) {
        const needsLogin = String(state.error || "").toLowerCase().includes("sign in");

        return `
            <section class="panel connection-panel">
                <div class="panel-header">
                    <div>
                        <h2>${needsLogin ? "Dashboard Login Required" : "Supabase Setup Required"}</h2>
                        <p>${esc(state.error || "The dashboard could not connect to Supabase.")}</p>
                    </div>
                </div>
                ${needsLogin
                    ? `
                        <p class="muted">
                            Your Supabase RLS policies allow worker submissions through anon access,
                            but employer dashboard reads require a signed-in Supabase Auth user.
                        </p>
                        <a class="primary-button" href="login.html">Go to Login</a>
                    `
                    : `
                        <p class="muted">
                            Update <strong>supabase-config.js</strong> with your Supabase project URL,
                            public anon key, and the table name used by the worker mobile app.
                            The dashboard does not contain mock fallback data.
                        </p>
                    `}
            </section>
        `;
    }

    function connectionNotice() {
        const state = services.getConnectionState();
        const tableErrors = Object.entries(state.tableErrors || {});

        if (!tableErrors.length) {
            return "";
        }

        return `
            <section class="panel connection-panel warning">
                <div class="panel-header">
                    <div>
                        <h2>Supabase Table Notice</h2>
                        <p>Some configured tables could not be read. Check table names, RLS policies and anon-key permissions.</p>
                    </div>
                </div>
                <ul>
                    ${tableErrors.map(function ([table, message]) {
                        return `<li><strong>${esc(table)}:</strong> ${esc(message)}</li>`;
                    }).join("")}
                </ul>
            </section>
        `;
    }

    function emptyState(message) {
        return `
            <section class="panel empty-state">
                <h2>No Live Data Yet</h2>
                <p>${esc(message)}</p>
            </section>
        `;
    }

    function kpiCard(title, value, detail, tone) {
        return `
            <article class="kpi-card ${tone}">
                <span>${esc(title)}</span>
                <strong>${esc(String(value))}</strong>
                <small>${esc(detail)}</small>
            </article>
        `;
    }

    function driftCard(drift) {
        return `
            <article class="drift-card">
                <div>
                    <span class="eyebrow">Barrier</span>
                    <h3>${esc(drift.barrier)}</h3>
                </div>
                <div class="metric-grid">
                    ${miniMetric("Current period", drift.currentPeriodReports + " reports")}
                    ${miniMetric("Previous period", drift.previousPeriodReports + " reports")}
                    ${miniMetric("Trend", trendLabel(drift.trend))}
                    ${miniMetric("Main site", drift.mainAffectedSite)}
                </div>
                <p><strong>Recommendation:</strong> ${esc(drift.recommendation || "Review field controls with site HSE.")}</p>
            </article>
        `;
    }

    function activityItem(activity) {
        return `
            <article class="activity-item">
                <span class="activity-dot"></span>
                <div>
                    <strong>${esc(activity.type)}</strong>
                    <p>${esc(activity.detail)}</p>
                </div>
                <small>${relativeTime(activity.timestamp)}</small>
            </article>
        `;
    }

    function fingerprintStep(label, value) {
        return `
            <article>
                <span>${esc(label)}</span>
                <strong>${esc(value)}</strong>
            </article>
        `;
    }

    function scoreCard(label, value, tone) {
        return `
            <article class="score-card ${priorityClass(tone)}">
                <span>${esc(label)}</span>
                <strong>${esc(value)}</strong>
            </article>
        `;
    }

    function meta(label, value) {
        return `
            <div>
                <span>${esc(label)}</span>
                <strong>${esc(value)}</strong>
            </div>
        `;
    }

    function miniMetric(label, value) {
        return `
            <div class="mini-metric">
                <span>${esc(label)}</span>
                <strong>${esc(String(value))}</strong>
            </div>
        `;
    }

    function settingRow(title, description, checked) {
        return `
            <div class="setting-row">
                <div>
                    <strong>${esc(title)}</strong>
                    <p>${esc(description)}</p>
                </div>
                <label class="switch">
                    <input type="checkbox" ${checked ? "checked" : ""}>
                    <span></span>
                </label>
            </div>
        `;
    }

    function filterSelect(id, label, options) {
        return `
            <label>
                ${esc(label)}
                <select id="${id}">
                    ${optionList(options)}
                </select>
            </label>
        `;
    }

    function optionList(options, labels) {
        return options.map(function (option) {
            const label = option === "all"
                ? "All"
                : (labels && labels[option] ? labels[option] : cap(option));

            return `<option value="${esc(option)}">${esc(label)}</option>`;
        }).join("");
    }

    function filterMatches(filterId, value) {
        const selected = document.getElementById(filterId).value;

        if (selected === "all") {
            return true;
        }

        if (Array.isArray(value)) {
            return value.includes(selected);
        }

        return value === selected;
    }

    function dateMatches(selected, receivedAt) {
        if (selected === "all") {
            return true;
        }

        const hours = selected === "24h" ? 24 : 24 * 7;
        const elapsedHours = (Date.now() - new Date(receivedAt).getTime()) / 36e5;

        return elapsedHours <= hours;
    }

    function recommendedActions(report) {
        const rule = report.analysis.lifeSavingRules[0];

        if (rule === "Energy Isolation") {
            return [
                "Stop work in the affected area until isolation is verified.",
                "Verify isolation before work resumes.",
                "Inspect similar pumps in the area."
            ];
        }

        if (rule === "Working at Height") {
            return [
                "Pause elevated work until fall protection is confirmed.",
                "Inspect ladder setup and anchor points.",
                "Brief crew on working-at-height controls."
            ];
        }

        if (rule === "Line of Fire") {
            return [
                "Create an exclusion zone around the exposure path.",
                "Verify spotter or barricading controls before work continues.",
                "Review similar nearby work fronts."
            ];
        }

        return [
            "Stop affected task and verify controls.",
            "Assign supervisor field check.",
            "Capture evidence before HSE verification."
        ];
    }

    function lifeSavingRuleText(rule) {
        const copy = {
            "Energy Isolation": "Work must not begin until hazardous energy sources are isolated and verified.",
            "Working at Height": "Use fall protection and verified access controls before elevated work starts.",
            "Line of Fire": "Keep workers out of the path of moving, dropped, released or pressurised energy.",
            "Hot Work": "Control ignition sources and verify atmosphere before hot work begins.",
            "Confined Space": "Confirm permit, isolation, atmosphere and rescue controls before entry.",
            "Safe Mechanical Lifting": "Plan lifts, inspect lifting gear and keep people clear of suspended loads.",
            "Housekeeping": "Keep work areas clear so routine movement does not create injury exposure."
        };

        return copy[rule] || "Verify the matching life-saving control before work proceeds.";
    }

    function heroMessage(page) {
        const messages = {
            dashboard: "Better data.<br>Safer decisions.",
            triage: "Prioritise fast.<br>Review with care.",
            report: "Evidence first.<br>HSE decides.",
            risk: "See the signals.<br>Act earlier.",
            patterns: "Find repeats.<br>Strengthen barriers.",
            actions: "Assign clearly.<br>Verify closure.",
            settings: "Tune alerts.<br>Keep focus.",
            pdf: "Export clearly.<br>Review offline."
        };

        return messages[page] || messages.dashboard;
    }

    function priorityClass(value) {
        const normalized = String(value).toLowerCase();

        if (normalized === "critical" || normalized === "high") {
            return normalized === "critical" ? "danger" : "warn";
        }

        if (normalized === "medium") {
            return "info";
        }

        if (normalized === "low" || normalized === "verified" || normalized === "success") {
            return "success";
        }

        return "info";
    }

    function statusClass(status) {
        if (status === "submitted" || status === "open") {
            return "warn";
        }

        if (status === "action_taken") {
            return "info";
        }

        if (status === "verified") {
            return "success";
        }

        return "info";
    }

    function statusLabel(status) {
        return services.lifecycleStatus[status] || services.actionStatus[status] || cap(status);
    }

    function trendLabel(trend) {
        return trend === "Increasing" ? "Increasing" : "Stable";
    }

    function relativeTime(value) {
        if (!value) {
            return "Not available";
        }

        const diffMs = Date.now() - new Date(value).getTime();

        if (Number.isNaN(diffMs)) {
            return "Not available";
        }

        const minutes = Math.max(1, Math.round(diffMs / 60000));

        if (minutes < 60) {
            return minutes + " min ago";
        }

        const hours = Math.round(minutes / 60);

        if (hours < 24) {
            return hours + " hr ago";
        }

        return Math.round(hours / 24) + " days ago";
    }

    function formatDate(value) {
        if (!value) {
            return "Not available";
        }

        return new Date(value + "T00:00:00").toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    function tomorrowDate() {
        const value = new Date();
        value.setDate(value.getDate() + 1);

        return value.toISOString().slice(0, 10);
    }

    function dateTimeLabel(value) {
        return relativeTime(value);
    }

    function confidenceLabel(value) {
        return value === null || value === undefined ? "Not available" : Math.round(value * 100) + "%";
    }

    function unique(values) {
        return [...new Set(values)].filter(Boolean).sort();
    }

    function cap(value) {
        return String(value)
            .replace(/_/g, " ")
            .replace(/\b\w/g, function (letter) {
                return letter.toUpperCase();
            });
    }

    function esc(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    document.addEventListener("DOMContentLoaded", init);
})();
