// Data services for Sanketak, backed by the FastAPI backend.
// This file intentionally contains no mock report data.
//
// Everything on every screen is derived from two reads: GET /reports/ and
// GET /actions/. The aggregators below (risk radar, patterns, drift, sites,
// summary, activity) are pure functions over those two lists.
//
// Where the backend records nothing, the field says so rather than carrying a
// derived stand-in. See NOT_RECORDED.

// --------------------------------------------------------------------------
// Backend timestamps
//
// FastAPI serialises a naive datetime with no timezone designator, e.g.
// "2026-09-27T23:42:49.268600". The values are UTC, but `new Date(...)` on a
// string with no designator applies the VIEWER's local timezone, so in IST
// (UTC+5:30) every timestamp read 5.5 hours early: a report filed one minute
// ago displayed as "6 hr ago".
//
// One helper, used by both hse-services.js and hse-app.js, so the rule lives
// in a single place instead of being appended at each call site.
// --------------------------------------------------------------------------
window.SanketakTime = (function () {
    // "2026-11-01"
    const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
    // trailing "Z", "+05:30", "+0530" or "-08:00"
    const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

    function parse(value) {
        if (!value) {
            return null;
        }

        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value;
        }

        const text = String(value).trim();

        if (!text) {
            return null;
        }

        let parsed;

        if (DATE_ONLY.test(text)) {
            // A calendar date, not an instant. Local midnight keeps it on the
            // same day for every viewer; forcing UTC would move a due date
            // back a day for anyone west of Greenwich.
            parsed = new Date(text + "T00:00:00");
        } else if (HAS_ZONE.test(text)) {
            // Already unambiguous. Left exactly as the backend sent it.
            parsed = new Date(text);
        } else {
            // Naive datetime: the case this helper exists for. The space form
            // is accepted too, since that is how psql prints the same value.
            parsed = new Date(text.replace(" ", "T") + "Z");
        }

        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    // Milliseconds since epoch, or 0 when unparseable, for sorting.
    function toTime(value) {
        const parsed = parse(value);
        return parsed ? parsed.getTime() : 0;
    }

    // The calendar-date portion, whatever shape arrived. due_date is a
    // DateTime column, so the backend returns "2026-11-01T00:00:00" while the
    // assignment form produces "2026-11-01"; callers that append "T00:00:00"
    // or "T23:59:59" need the bare date or they build an invalid string.
    function toCalendarDate(value) {
        if (!value) {
            return "";
        }

        const text = String(value).trim();

        if (DATE_ONLY.test(text)) {
            return text;
        }

        const match = text.match(/^(\d{4}-\d{2}-\d{2})/);

        return match ? match[1] : "";
    }

    return { parse: parse, toTime: toTime, toCalendarDate: toCalendarDate };
})();

(function () {
    // The backend has no field for this at all.
    const NOT_RECORDED = "Not recorded";
    // The backend has the field, but it is empty on this report.
    const NOT_AVAILABLE = "Not available";
    const lifecycleStatus = {
        submitted: "Submitted",
        under_review: "Under Review",
        action_assigned: "Action Assigned",
        action_taken: "Action Taken",
        verified: "Verified",
        not_set: "Not Set"
    };

    const actionStatus = {
        open: "Open",
        in_progress: "In Progress",
        action_taken: "Action Taken",
        verified: "Verified",
        not_set: "Not Set"
    };

    const priorityRank = {
        critical: 1,
        high: 2,
        medium: 3,
        low: 4,
        not_set: 5
    };

    const store = {
        reports: [],
        actions: [],
        initialized: false,
        configured: false,
        loading: false,
        error: "",
        writeWarning: "",
        onRefresh: null,
        taxonomyPromise: null,
        tableErrors: {}
    };

    async function initialize(onRefresh) {
        const config = getConfig();
        const validationError = validateConfig(config);

        if (validationError) {
            store.error = validationError;
            store.configured = false;
            return getConnectionState();
        }

        store.configured = true;
        store.loading = true;
        store.error = "";
        store.onRefresh = typeof onRefresh === "function" ? onRefresh : null;

        if (!window.SanketakAuth.isSignedIn()) {
            store.loading = false;
            store.error = "Your session has ended. Redirecting to sign in.";
            goToLogin();
            return getConnectionState();
        }

        try {
            // Taxonomy labels must be in place before the first normalize,
            // or raw ACT_*/HAZ_* ids reach the screen.
            await loadTaxonomy();
            await refreshAll();

            store.loading = false;
            store.initialized = true;
        } catch (error) {
            store.loading = false;
            store.error = error.message;
        }

        return getConnectionState();
    }

    async function refreshAll() {
        const results = await Promise.all([
            apiGet("/reports/", "reports"),
            apiGet("/actions/", "actions")
        ]);

        const rawReports = results[0];
        const rawActions = results[1];

        store.reports = rawReports.map(normalizeReport);
        store.actions = rawActions.map(function (row) {
            return normalizeAction(row, store.reports);
        });

        store.reports = store.reports.map(function (report) {
            const linkedActions = store.actions.filter(function (action) {
                return action.reportId === report.id || action.trackingToken === report.trackingToken;
            });

            return {
                ...report,
                actions: mergeActions(report.actions, linkedActions)
            };
        });
    }

    // Reads a JSON collection from the backend. Returns [] and records the
    // reason on failure, so one broken endpoint does not blank the whole page.
    async function apiGet(path, key) {
        const auth = window.SanketakAuth;
        let response;

        try {
            response = await withTimeout(
                fetch(auth.apiUrl(path), { headers: auth.authHeaders() }),
                12000,
                "Reading " + path + " from the backend timed out."
            );
        } catch (error) {
            store.tableErrors[key] = "Could not reach the backend at " + getConfig().apiBaseUrl + ".";
            return [];
        }

        if (response.status === 401) {
            handleUnauthorized();
            return [];
        }

        if (!response.ok) {
            store.tableErrors[key] = path + " returned HTTP " + response.status + ".";
            return [];
        }

        let data;

        try {
            data = await response.json();
        } catch (error) {
            store.tableErrors[key] = path + " did not return JSON.";
            return [];
        }

        // Several endpoints answer a miss with {"error": "..."} and HTTP 200.
        if (data && data.error) {
            store.tableErrors[key] = String(data.error);
            return [];
        }

        delete store.tableErrors[key];
        return Array.isArray(data) ? data : [];
    }

    // The backend has no realtime channel, so there is nothing to subscribe
    // to. Callers refresh explicitly via refreshAll().
    async function refreshNow() {
        store.loading = true;
        await refreshAll();
        store.loading = false;

        if (store.onRefresh) {
            store.onRefresh();
        }

        return getConnectionState();
    }

    function getReports() {
        return [...store.reports].sort(byPriorityThenNewest);
    }

    function getReportById(id) {
        const reports = getReports();

        if (!id) {
            return reports[0] || null;
        }

        return reports.find(function (report) {
            return report.id === id || report.trackingToken === id;
        }) || null;
    }

    function getDashboardSummary() {
        const reports = store.reports;
        const actions = getActions();

        return {
            reportsReceived: reports.length,
            needsReview: reports.filter(function (report) {
                return report.status === "submitted";
            }).length,
            highSifPotential: reports.filter(function (report) {
                return report.sifPotential === "high";
            }).length,
            openCorrectiveActions: actions.filter(function (action) {
                return action.status !== "verified";
            }).length,
            criticalReports: reports.filter(function (report) {
                return report.priority === "critical";
            }).length
        };
    }

    function getPriorityReports(limit) {
        return getReports().slice(0, limit || 5);
    }

    function getBarrierDriftConcerns() {
        const grouped = {};

        store.reports.forEach(function (report) {
            const drift = report.barrierDrift;
            const key = drift.barrier || report.analysis.barrierFailure || "Not available";

            if (!grouped[key]) {
                grouped[key] = {
                    barrier: key,
                    currentPeriodReports: 0,
                    previousPeriodReports: 0,
                    trend: drift.trend || "Stable",
                    mainAffectedSite: drift.mainAffectedSite || report.site,
                    recommendation: drift.recommendation || "Review repeated barrier weakness with site HSE."
                };
            }

            grouped[key].currentPeriodReports += 1;

            if (drift.currentPeriodReports) {
                grouped[key].currentPeriodReports = Math.max(grouped[key].currentPeriodReports, drift.currentPeriodReports);
            }

            if (drift.previousPeriodReports) {
                grouped[key].previousPeriodReports = Math.max(grouped[key].previousPeriodReports, drift.previousPeriodReports);
            }

            if (drift.trend === "Increasing") {
                grouped[key].trend = "Increasing";
            }
        });

        return Object.values(grouped)
            .sort(function (a, b) {
                return b.currentPeriodReports - a.currentPeriodReports;
            })
            .slice(0, 4);
    }

    function getSiteOverview() {
        const grouped = {};

        store.reports.forEach(function (report) {
            if (!grouped[report.site]) {
                grouped[report.site] = {
                    site: report.site,
                    reports: 0,
                    highSif: 0,
                    issues: {}
                };
            }

            grouped[report.site].reports += 1;

            if (report.sifPotential === "high") {
                grouped[report.site].highSif += 1;
            }

            const issue = report.analysis.lifeSavingRules[0] || "Not available";
            grouped[report.site].issues[issue] = (grouped[report.site].issues[issue] || 0) + 1;
        });

        return Object.values(grouped).map(function (site) {
            return {
                site: site.site,
                reports: site.reports,
                highSif: site.highSif,
                dominantIssue: topKey(site.issues)
            };
        });
    }

    function getActions() {
        const reportActions = store.reports.flatMap(function (report) {
            return report.actions.map(function (action) {
                return {
                    ...action,
                    reportId: report.id,
                    trackingToken: action.trackingToken || report.trackingToken,
                    site: action.site || report.site,
                    area: action.area || report.area,
                    reportDescription: report.description
                };
            });
        });

        return mergeActions(store.actions, reportActions);
    }

    function getRiskRadar() {
        const grouped = {};

        store.reports.forEach(function (report) {
            const key = report.site + "|" + report.area;

            if (!grouped[key]) {
                grouped[key] = {
                    site: report.site,
                    area: report.area,
                    reportCount: 0,
                    highSifCount: 0,
                    hazards: {},
                    barriers: {},
                    rules: {},
                    trend: "Stable",
                    affectedReports: []
                };
            }

            grouped[key].reportCount += 1;
            grouped[key].affectedReports.push(report.trackingToken);

            if (report.sifPotential === "high") {
                grouped[key].highSifCount += 1;
            }

            grouped[key].hazards[report.analysis.hazard] =
                (grouped[key].hazards[report.analysis.hazard] || 0) + 1;
            grouped[key].barriers[report.analysis.barrierFailure] =
                (grouped[key].barriers[report.analysis.barrierFailure] || 0) + 1;
            report.analysis.lifeSavingRules.forEach(function (rule) {
                grouped[key].rules[rule] = (grouped[key].rules[rule] || 0) + 1;
            });

            if (report.barrierDrift.trend === "Increasing") {
                grouped[key].trend = "Increasing";
            }
        });

        return Object.values(grouped)
            .map(function (entry) {
                return {
                    ...entry,
                    dominantHazard: topKey(entry.hazards),
                    dominantBarrierFailure: topKey(entry.barriers),
                    lifeSavingRule: topKey(entry.rules)
                };
            })
            .sort(function (a, b) {
                return b.highSifCount - a.highSifCount || b.reportCount - a.reportCount;
            });
    }

    function getPatterns() {
        const grouped = {};

        store.reports.forEach(function (report) {
            const key = [
                report.analysis.activity,
                report.analysis.hazard,
                report.analysis.barrierFailure
            ].join(" + ");

            if (!grouped[key]) {
                grouped[key] = {
                    pattern: key,
                    reports: 0,
                    highSif: 0,
                    sites: {},
                    trend: "Stable",
                    lifeSavingRule: report.analysis.lifeSavingRules[0] || "Not available",
                    activity: report.analysis.activity,
                    hazard: report.analysis.hazard,
                    barrier: report.analysis.barrierFailure,
                    affectedReports: []
                };
            }

            grouped[key].reports += 1;
            grouped[key].affectedReports.push(report.trackingToken);
            grouped[key].sites[report.site] = (grouped[key].sites[report.site] || 0) + 1;

            if (report.sifPotential === "high") {
                grouped[key].highSif += 1;
            }

            if (report.barrierDrift.trend === "Increasing") {
                grouped[key].trend = "Increasing";
            }
        });

        return Object.values(grouped)
            .map(function (pattern) {
                return {
                    ...pattern,
                    primarySite: topKey(pattern.sites)
                };
            })
            .sort(function (a, b) {
                return b.highSif - a.highSif || b.reports - a.reports;
            });
    }

    function getRecentActivity() {
        return getReports().slice(0, 8).map(function (report) {
            return {
                type: report.status === "submitted" ? "New report submitted" : "Report updated",
                detail: report.trackingToken + " - " + report.description,
                timestamp: report.receivedAt
            };
        });
    }

    function normalizeReport(row) {
        const fingerprint = parseJson(row.fingerprint) || {};
        const barrierFailures = toArray(fingerprint.barrier_failures);
        const primaryBarrier = barrierFailures.find(function (failure) {
            return failure && failure.primary;
        }) || barrierFailures[0] || null;

        return {
            id: String(row.id || ""),
            // The report's own id, not anon_token. That token is the
            // worker's private handle for their own report and is no longer
            // returned to HSE users; this is the same value the detail page
            // and every report.html?id= link already use.
            trackingToken: String(row.id || ""),
            // The backend stores no short description, only the full report
            // text. Shortened here for tables; originalReport keeps it whole.
            description: shorten(row.raw_text),
            originalReport: String(row.raw_text || NOT_AVAILABLE),
            // Not captured by the backend: there is no channel/audio/photo
            // field on a report.
            reportingMethod: NOT_RECORDED,
            reportLanguage: languageName(row.language),
            detectedLanguage: String(fingerprint.language || row.language || ""),
            site: String(row.site_tag || NOT_RECORDED),
            // Not captured by the backend. equipment_tag exists but is
            // equipment, not an area, so it is not passed off as one.
            area: NOT_RECORDED,
            receivedAt: row.submitted_at || "",
            status: normalizeStatus(row.status),
            // Not captured by the backend: a report carries no officer-set
            // priority. Derived from the model's own output instead, so the
            // column ranks the queue rather than reading "Not Set" on every
            // row. See derivePriority for the mapping.
            priority: derivePriority(row.risk_level, row.sif_probability),
            sifPotential: normalizeSif(row.risk_level),
            modelConfidence: normalizeConfidence(row.sif_probability),
            analysis: {
                activity: label(fingerprint.activity),
                hazard: label(fingerprint.hazard),
                exposure: label(fingerprint.exposure),
                barrierFailure: describeBarrierFailure(primaryBarrier),
                potentialConsequence: label(fingerprint.potential_consequence),
                lifeSavingRules: labelList(fingerprint.life_saving_rules)
            },
            evidence: buildEvidence(barrierFailures, toArray(row.reason)),
            // Not captured by the backend.
            relatedSignals: [],
            // Barrier drift lives behind GET /intelligence/{id}, one call per
            // report. Left empty rather than fanning out N requests; the
            // dashboard panel says so instead of showing a derived number.
            barrierDrift: emptyBarrierDrift(),
            // Precedents live behind GET /precedents/{id}, also per report,
            // and carry no score, year, factors or lesson.
            precedents: [],
            actions: [],
            raw: row
        };
    }

    function normalizeAction(row, reports) {
        const reportId = String(row.report_id || "");
        const report = reports.find(function (item) {
            return item.id === reportId;
        }) || {};

        return {
            id: String(row.id || ""),
            reportId: reportId,
            trackingToken: report.trackingToken || NOT_AVAILABLE,
            description: String(row.description || NOT_AVAILABLE),
            assignedTo: String(row.owner || "Not assigned"),
            dueDate: row.due_date || "",
            priority: normalizePriority(row.priority),
            status: normalizeActionStatus(row.status),
            verificationRequired: Boolean(row.verification_required),
            // Joined from the linked report; the action row has neither.
            site: report.site || NOT_RECORDED,
            area: report.area || NOT_RECORDED,
            reportDescription: report.description || "",
            raw: row
        };
    }

    function normalizeEvidence(item) {
        if (typeof item === "string") {
            return {
                text: item,
                type: "Evidence",
                interpretation: "Mapped evidence from worker report."
            };
        }

        return {
            text: String(item.text || item.quote || item.evidence || "Not available"),
            type: String(item.type || item.category || "Evidence"),
            interpretation: String(item.interpretation || item.mapped_to || item.mapping || "Not available")
        };
    }

    function normalizePrecedent(item) {
        return {
            title: String(item.title || item.incident_title || "Not available"),
            year: item.year || item.incident_year || "Not available",
            source: String(item.source || "Not available"),
            similarityScore: normalizeConfidence(item.similarityScore || item.similarity_score),
            matchingFactors: toArray(item.matchingFactors || item.matching_factors),
            keyLesson: String(item.keyLesson || item.key_lesson || "Not available")
        };
    }

    function normalizeBarrierDrift(drift, row) {
        return {
            barrier: String(drift.barrier || row.barrier_drift_barrier || row.barrier_failure || "Not available"),
            currentPeriodReports: Number(drift.currentPeriodReports || drift.current_period_reports || row.current_period_reports || 0),
            previousPeriodReports: Number(drift.previousPeriodReports || drift.previous_period_reports || row.previous_period_reports || 0),
            trend: normalizeTrend(drift.trend || row.trend),
            mainAffectedSite: String(drift.mainAffectedSite || drift.main_affected_site || row.site || "Not available"),
            recommendation: String(drift.recommendation || row.recommendation || "Review repeated barrier weakness with site HSE.")
        };
    }

    function mergeActions(primary, secondary) {
        const map = new Map();

        primary.concat(secondary).forEach(function (action) {
            const key = action.id || action.trackingToken + "|" + action.description;
            map.set(key, action);
        });

        return Array.from(map.values());
    }

    function byPriorityThenNewest(a, b) {
        const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority];

        if (priorityDelta !== 0) {
            return priorityDelta;
        }

        return window.SanketakTime.toTime(b.receivedAt) - window.SanketakTime.toTime(a.receivedAt);
    }

    async function assignCorrectiveAction(report, values) {
        const auth = window.SanketakAuth;
        const params = new URLSearchParams({
            report_id: report.id || "",
            description: values.description || ""
        });

        if (values.assignedTo) {
            params.set("owner", values.assignedTo);
        }

        if (values.dueDate) {
            params.set("due_date", values.dueDate);
        }

        if (values.priority) {
            params.set("priority", values.priority);
        }

        params.set("verification_required", values.verificationRequired ? "true" : "false");

        const response = await fetch(auth.apiUrl("/actions/?" + params.toString()), {
            method: "POST",
            headers: auth.authHeaders()
        });

        if (response.status === 401) {
            handleUnauthorized();
            throw new Error("Your session has ended. Sign in again.");
        }

        if (!response.ok) {
            throw new Error("Creating the corrective action failed (HTTP " + response.status + ").");
        }

        const created = await response.json();

        if (created && created.error) {
            throw new Error(String(created.error));
        }

        await markReportActionAssigned(report);
        await refreshAll();

        return { action: created, droppedFields: [] };
    }

    // The backend issues stateless JWTs and has no logout endpoint, so
    // signing out means dropping the token held here.
    async function signOut() {
        window.SanketakAuth.clearToken();
        store.reports = [];
        store.actions = [];
        store.initialized = false;
        localStorage.removeItem("sanketak_logged_in");
    }

    async function markReportActionAssigned(report) {
        if (!report.id) {
            return;
        }

        const auth = window.SanketakAuth;
        const params = new URLSearchParams({ new_status: "action_assigned" });

        await fetch(auth.apiUrl("/reports/" + encodeURIComponent(report.id) + "/status?" + params.toString()), {
            method: "PATCH",
            headers: auth.authHeaders()
        });
    }

    function getConnectionState() {
        return {
            initialized: store.initialized,
            configured: store.configured,
            loading: store.loading,
            error: store.error,
            writeWarning: store.writeWarning,
            // Barrier drift and precedents are per-report endpoints and are
            // not loaded in bulk. Screens check this instead of rendering a
            // derived stand-in.
            driftAvailable: false,
            precedentsAvailable: false,
            tableErrors: { ...store.tableErrors }
        };
    }

    function withTimeout(promise, timeoutMs, message) {
        let timeoutId;

        const timeout = new Promise(function (_, reject) {
            timeoutId = setTimeout(function () {
                reject(new Error(message));
            }, timeoutMs);
        });

        return Promise.race([promise, timeout]).finally(function () {
            clearTimeout(timeoutId);
        });
    }

    function getConfig() {
        return window.SanketakConfig || {};
    }

    function validateConfig(config) {
        if (!window.SanketakAuth) {
            return "supabase-config.js did not load, so there is no backend configuration or token helper.";
        }

        if (!config.apiBaseUrl) {
            return "Set apiBaseUrl to the FastAPI backend URL in supabase-config.js.";
        }

        return "";
    }

    function pick(row, keys) {
        for (const key of keys) {
            if (row && row[key] !== undefined && row[key] !== null && row[key] !== "") {
                return row[key];
            }
        }

        return "";
    }

    function nested(value, key) {
        const parsed = parseJson(value);
        return parsed && parsed[key];
    }

    function parseJson(value) {
        if (!value) {
            return null;
        }

        if (typeof value === "object") {
            return value;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            return null;
        }
    }

    function toArray(value) {
        const parsed = parseJson(value);
        const actual = parsed || value;

        if (!actual) {
            return [];
        }

        if (Array.isArray(actual)) {
            return actual;
        }

        if (typeof actual === "string") {
            return actual.split(",").map(function (item) {
                return item.trim();
            }).filter(Boolean);
        }

        return [actual];
    }

    function normalizeStatus(value) {
        const normalized = normalizeToken(value);

        if (!normalized) {
            return "submitted";
        }

        if (["submitted", "new", "needs_review", "pending"].includes(normalized)) {
            return "submitted";
        }

        if (["under_review", "review", "reviewing", "in_review"].includes(normalized)) {
            return "under_review";
        }

        if (["action_assigned", "assigned"].includes(normalized)) {
            return "action_assigned";
        }

        if (["action_taken", "actioned", "taken"].includes(normalized)) {
            return "action_taken";
        }

        if (["verified", "closed", "complete", "completed"].includes(normalized)) {
            return "verified";
        }

        return "not_set";
    }

    function normalizeActionStatus(value) {
        const normalized = normalizeToken(value);

        if (!normalized) {
            return "open";
        }

        if (["open", "submitted", "new", "needs_review"].includes(normalized)) {
            return "open";
        }

        if (["in_progress", "progress", "under_review", "in_review"].includes(normalized)) {
            return "in_progress";
        }

        if (["action_taken", "actioned", "taken", "done"].includes(normalized)) {
            return "action_taken";
        }

        if (["verified", "closed", "complete", "completed"].includes(normalized)) {
            return "verified";
        }

        return "not_set";
    }

    function normalizePriority(value) {
        const normalized = normalizeToken(value);

        if (["critical", "high", "medium", "low"].includes(normalized)) {
            return normalized;
        }

        return "not_set";
    }

    function normalizeSif(value) {
        const normalized = normalizeToken(value);

        if (["high", "medium", "low"].includes(normalized)) {
            return normalized;
        }

        if (normalized === "true" || normalized === "yes") {
            return "high";
        }

        if (normalized === "false" || normalized === "no") {
            return "low";
        }

        return "not_set";
    }

    // A report has no priority field of its own, so one is derived from the
    // model's risk_level, with sif_probability splitting the HIGH band: a
    // 0.92 and a 0.71 are both HIGH, but only the first warrants pulling an
    // officer off whatever they are doing. Derived, never stored — if a
    // report is rescored, its priority follows.
    const CRITICAL_PROBABILITY = 0.85;

    function derivePriority(riskLevel, sifProbability) {
        const level = normalizeSif(riskLevel);
        const probability = normalizeConfidence(sifProbability);

        if (level === "high") {
            return probability !== null && probability >= CRITICAL_PROBABILITY
                ? "critical"
                : "high";
        }

        if (level === "medium") {
            return "medium";
        }

        if (level === "low") {
            return "low";
        }

        // No risk_level at all (an unscored report). The probability alone
        // still ranks it if one is present; otherwise the column stays
        // honest and says nothing.
        if (probability === null) {
            return "not_set";
        }

        if (probability >= CRITICAL_PROBABILITY) {
            return "critical";
        }

        if (probability >= 0.7) {
            return "high";
        }

        if (probability >= 0.5) {
            return "medium";
        }

        return "low";
    }

    function normalizeTrend(value) {
        const normalized = normalizeToken(value);
        return normalized.includes("increasing") || normalized.includes("up") ? "Increasing" : "Stable";
    }

    function normalizeConfidence(value) {
        // Number(null) and Number("") are both 0, which would read as a
        // genuine score of zero rather than the absent value it is.
        if (value === null || value === undefined || value === "") {
            return null;
        }

        const number = Number(value);

        if (Number.isNaN(number)) {
            return null;
        }

        return number > 1 ? number / 100 : number;
    }

    function normalizeToken(value) {
        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/[\s-]+/g, "_");
    }

    function inferReportingMethod(row) {
        if (row.audio_url || row.recording_url) {
            return "Voice";
        }

        if (row.photo_url || row.image_url) {
            return "Photo";
        }

        return "Text";
    }

    function topKey(counts) {
        const entries = Object.entries(counts).sort(function (a, b) {
            return b[1] - a[1];
        });

        return entries[0] ? entries[0][0] : "Not available";
    }

    // --- Per-report intelligence ------------------------------------------
    //
    // Drift and precedents are per-report endpoints. They are loaded for the
    // one report on screen, never in a loop over the list.
    async function loadReportIntelligence(reportId) {
        const result = {
            available: false,
            error: "",
            drift: [],
            driftSlice: null,
            emergingRisks: [],
            relatedSignals: [],
            precedents: [],
            precedentsAvailable: false
        };

        if (!reportId) {
            result.error = "This report has no id, so intelligence cannot be requested.";
            return result;
        }

        const responses = await Promise.all([
            apiGetObject("/intelligence/" + encodeURIComponent(reportId)),
            apiGetObject("/precedents/" + encodeURIComponent(reportId))
        ]);

        const intelligence = responses[0];
        const precedents = responses[1];

        if (intelligence.error) {
            result.error = intelligence.error;
        } else {
            const data = intelligence.data || {};
            result.available = true;

            result.drift = toArray(data.barrier_drift).map(function (row) {
                return {
                    barrier: label(row.barrier),
                    failureMode: label(row.failure_mode),
                    occurrences: Number(row.occurrences || 0),
                    riskStatus: String(row.risk_status || "")
                };
            });

            result.driftSlice = data.barrier_drift_slice || null;

            result.emergingRisks = toArray(data.emerging_risks).map(function (row) {
                return {
                    barrier: label(row.barrier),
                    failureMode: label(row.failure_mode),
                    recentOccurrences: Number(row.recent_occurrences || 0),
                    baselineOccurrences: Number(row.baseline_occurrences || 0),
                    rateRatio: Number(row.rate_ratio || 0),
                    riskStatus: String(row.risk_status || "")
                };
            });

            // The engine's "precedents" are other reports in this corpus, not
            // historical disasters — they belong in Related Safety Signals.
            result.relatedSignals = toArray(data.precedents).map(function (row) {
                const match = getReportById(row.report_id);

                return {
                    reportId: row.report_id,
                    trackingToken: match ? match.trackingToken : row.report_id,
                    site: match ? match.site : NOT_RECORDED,
                    area: match ? match.area : NOT_RECORDED,
                    barrierFailure: match ? match.analysis.barrierFailure : NOT_AVAILABLE,
                    receivedAt: match ? match.receivedAt : "",
                    matchScore: Number(row.match_score || 0),
                    vectorSimilarity: Number(row.vector_similarity || 0),
                    resolved: Boolean(match)
                };
            });
        }

        if (!precedents.error) {
            const data = precedents.data || {};
            result.precedentsAvailable = true;
            // Only name, description and source exist. No year, similarity
            // score, matching factors or key lesson is recorded, so none is
            // shown.
            result.precedents = toArray(data.matches).map(function (row) {
                return {
                    title: String(row.name || NOT_AVAILABLE),
                    description: String(row.description || ""),
                    source: String(row.source || NOT_AVAILABLE)
                };
            });
        }

        return result;
    }

    // Reads a single JSON object (not a collection) from the backend.
    async function apiGetObject(path) {
        const auth = window.SanketakAuth;
        let response;

        try {
            response = await withTimeout(
                fetch(auth.apiUrl(path), { headers: auth.authHeaders() }),
                20000,
                "Reading " + path + " from the backend timed out."
            );
        } catch (error) {
            return { error: "Could not reach the backend at " + getConfig().apiBaseUrl + "." };
        }

        if (response.status === 401) {
            handleUnauthorized();
            return { error: "Your session has ended." };
        }

        if (!response.ok) {
            return { error: path + " returned HTTP " + response.status + "." };
        }

        let data;

        try {
            data = await response.json();
        } catch (error) {
            return { error: path + " did not return JSON." };
        }

        if (data && data.error) {
            return { error: String(data.error) };
        }

        return { data: data };
    }

    function cap(value) {
        return String(value || "")
            .replace(/_/g, " ")
            .replace(/\b\w/g, function (letter) {
                return letter.toUpperCase();
            });
    }

    // --- Backend-specific helpers -------------------------------------------

    // Resolves a taxonomy id (ACT_*, HAZ_*, LSR_*, BAR_*, FM_*, ...) to its
    // human label. Never lets a raw id through to a screen.
    function label(value) {
        if (!value) {
            return NOT_AVAILABLE;
        }

        if (window.SanketakTaxonomy) {
            return window.SanketakTaxonomy.label(value);
        }

        return String(value);
    }

    function labelList(values) {
        return toArray(values).map(label).filter(function (item) {
            return item && item !== NOT_AVAILABLE;
        });
    }

    function describeBarrierFailure(failure) {
        if (!failure || !failure.barrier) {
            return NOT_AVAILABLE;
        }

        if (!failure.failure_mode) {
            return label(failure.barrier);
        }

        return label(failure.barrier) + " - " + label(failure.failure_mode);
    }

    // The backend stores an ISO code; an HSE officer reads a language name.
    // Whisper sometimes reports the name already, so both forms are accepted
    // and anything unrecognised is shown as it was stored rather than guessed.
    function languageName(value) {
        const raw = String(value || "").trim().toLowerCase();

        if (!raw) {
            return NOT_AVAILABLE;
        }

        const names = {
            as: "Assamese",
            assamese: "Assamese",
            en: "English",
            english: "English",
            hi: "Hindi",
            hindi: "Hindi",
        };

        return names[raw] || String(value);
    }

    // Tables and cards expect a short description; the backend stores only
    // the full report text. Trimmed on a word boundary, never reworded.
    function shorten(text) {
        const value = String(text || "").replace(/\s+/g, " ").trim();

        if (!value) {
            return NOT_AVAILABLE;
        }

        if (value.length <= 120) {
            return value;
        }

        const cut = value.slice(0, 120);
        const lastSpace = cut.lastIndexOf(" ");

        return (lastSpace > 60 ? cut.slice(0, lastSpace) : cut) + "...";
    }

    // Evidence is the reporter's own words plus the SIF model's stated
    // reasons. The backend records no evidence type or interpretation, so
    // neither is invented here.
    function buildEvidence(barrierFailures, reasons) {
        const spans = barrierFailures.map(function (failure) {
            const text = failure && (failure.evidence_span || failure.evidence_span_en);

            if (!text) {
                return null;
            }

            return {
                text: String(text),
                type: "",
                interpretation: ""
            };
        }).filter(Boolean);

        const modelReasons = reasons.map(function (reason) {
            if (!reason) {
                return null;
            }

            return {
                text: String(reason),
                type: "Model reason",
                interpretation: ""
            };
        }).filter(Boolean);

        return spans.concat(modelReasons);
    }

    function emptyBarrierDrift() {
        return {
            barrier: "",
            currentPeriodReports: 0,
            previousPeriodReports: 0,
            trend: "Stable",
            mainAffectedSite: "",
            recommendation: ""
        };
    }

    function handleUnauthorized() {
        window.SanketakAuth.clearToken();
        store.error = "Your session has ended. Redirecting to sign in.";
        goToLogin();
    }

    function goToLogin() {
        const page = getConfig().loginPage || "login.html";

        if (!window.location.pathname.endsWith(page)) {
            window.location.href = page;
        }
    }

    // Loads the generated taxonomy label map. The HTML cannot be edited to
    // add a <script> tag, so it is injected once and awaited.
    function loadTaxonomy() {
        if (window.SanketakTaxonomy) {
            return Promise.resolve();
        }

        if (store.taxonomyPromise) {
            return store.taxonomyPromise;
        }

        store.taxonomyPromise = new Promise(function (resolve) {
            const script = document.createElement("script");
            script.src = "taxonomy-labels.js";
            script.onload = function () {
                resolve();
            };
            script.onerror = function () {
                // Labels are a display nicety; without them ids show through,
                // which is visible and reportable rather than silently wrong.
                store.tableErrors.taxonomy = "taxonomy-labels.js failed to load, so taxonomy codes are shown unlabelled.";
                resolve();
            };
            document.head.appendChild(script);
        });

        return store.taxonomyPromise;
    }

    window.SanketakServices = {
        initialize,
        refreshAll,
        refreshNow,
        getConnectionState,
        getReports,
        getReportById,
        getDashboardSummary,
        getPriorityReports,
        getBarrierDriftConcerns,
        getSiteOverview,
        getActions,
        getRiskRadar,
        getPatterns,
        getRecentActivity,
        loadReportIntelligence,
        assignCorrectiveAction,
        signOut,
        priorityRank,
        lifecycleStatus,
        actionStatus
    };
})();
