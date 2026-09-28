// Supabase-backed data services for Sanketak.
// This file intentionally contains no mock report data.

(function () {
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
        client: null,
        reports: [],
        actions: [],
        initialized: false,
        configured: false,
        loading: false,
        error: "",
        tableErrors: {}
    };

    async function initialize(onRealtimeUpdate) {
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
        store.client = window.supabase.createClient(config.url, config.anonKey);

        try {
            const sessionResponse = await withTimeout(
                store.client.auth.getSession(),
                10000,
                "Supabase Auth session check timed out."
            );

            if (!sessionResponse.data.session) {
                store.loading = false;
                store.error = "Sign in with a Supabase Auth dashboard user before opening the employer dashboard.";
                return getConnectionState();
            }

            await refreshAll();
            subscribeToRealtime(onRealtimeUpdate);

            store.loading = false;
            store.initialized = true;
        } catch (error) {
            store.loading = false;
            store.error = error.message;
        }

        return getConnectionState();
    }

    async function refreshAll() {
        const config = getConfig();
        const results = await Promise.all([
            fetchRows(config.tables.reports, "reports"),
            fetchRows(config.tables.actions, "actions")
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

    async function fetchRows(tableName, key) {
        if (!tableName) {
            return [];
        }

        let response;

        try {
            response = await withTimeout(
                store.client
                    .from(tableName)
                    .select("*")
                    .limit(500),
                12000,
                "Reading " + tableName + " from Supabase timed out."
            );
        } catch (error) {
            store.tableErrors[key] = error.message;
            return [];
        }

        if (response.error) {
            store.tableErrors[key] = response.error.message;
            return [];
        }

        delete store.tableErrors[key];
        return response.data || [];
    }

    function subscribeToRealtime(onRealtimeUpdate) {
        const config = getConfig();

        if (!config.realtime || !store.client) {
            return;
        }

        const realtimeTables = config.realtimeTables || Object.values(config.tables);

        realtimeTables.forEach(function (tableName) {
            if (!tableName) {
                return;
            }

            store.client
                .channel("sanketak-" + tableName)
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: config.schema || "public",
                        table: tableName
                    },
                    async function () {
                        store.loading = true;
                        await refreshAll();
                        store.loading = false;

                        if (typeof onRealtimeUpdate === "function") {
                            onRealtimeUpdate();
                        }
                    }
                )
                .subscribe();
        });
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
        const analysis = parseJson(row.analysis || row.ai_analysis || row.sif_fingerprint) || {};
        const evidence = parseJson(row.evidence || row.extracted_evidence || row.why_flagged) || [];
        const barrierDrift = parseJson(row.barrier_drift || row.barrierDrift) || {};
        const precedents = parseJson(row.precedents || row.related_precedents || row.precedent_engine) || [];
        const embeddedActions = parseJson(row.actions || row.corrective_actions) || [];
        const originalText = pick(row, [
            "original_report",
            "worker_report",
            "report_text",
            "transcript",
            "final_text",
            "description",
            "text",
            "summary"
        ]);

        return {
            id: String(pick(row, ["id", "uuid", "report_id", "tracking_id", "tracking_token"]) || ""),
            trackingToken: String(pick(row, ["tracking_token", "tracking_id", "report_code", "report_number", "id"]) || ""),
            description: String(pick(row, ["short_description", "description", "report_summary", "summary", "final_text", "report_text", "transcript", "text"]) || "Not available"),
            originalReport: String(originalText || "Not available"),
            reportingMethod: cap(String(pick(row, ["report_type", "reporting_method", "method", "submission_type", "channel"]) || inferReportingMethod(row))),
            reportLanguage: String(pick(row, ["report_language", "language", "detected_language"]) || "Not available"),
            detectedLanguage: String(pick(row, ["detected_language", "language"]) || ""),
            site: String(pick(row, ["site", "site_name", "location_site"]) || nested(row.location, "site") || "Not available"),
            area: String(pick(row, ["area", "area_name", "area_or_equipment", "location_area"]) || nested(row.location, "area") || "Not available"),
            receivedAt: pick(row, ["received_at", "submitted_at", "created_at", "timestamp", "date"]) || "",
            status: normalizeStatus(pick(row, ["status", "review_status", "workflow_status"])),
            priority: normalizePriority(pick(row, ["priority", "risk_priority", "severity", "risk_level"])),
            sifPotential: normalizeSif(pick(row, ["sif_potential", "sifPotential", "sif_level", "sif", "risk_level"])),
            modelConfidence: normalizeConfidence(pick(row, ["model_confidence", "confidence", "ai_confidence"])),
            analysis: {
                activity: String(analysis.activity || row.activity || "Not available"),
                hazard: String(analysis.hazard || row.hazard || "Not available"),
                exposure: String(analysis.exposure || row.exposure || "Not available"),
                barrierFailure: String(analysis.barrierFailure || analysis.barrier_failure || row.barrier_failure || row.barrier || "Not available"),
                potentialConsequence: String(analysis.potentialConsequence || analysis.potential_consequence || row.potential_consequence || "Not available"),
                lifeSavingRules: toArray(analysis.lifeSavingRules || analysis.life_saving_rules || row.life_saving_rules || row.life_saving_rule)
            },
            evidence: toArray(evidence).map(normalizeEvidence),
            relatedSignals: toArray(row.related_signals || row.relatedSignals),
            barrierDrift: normalizeBarrierDrift(barrierDrift, row),
            precedents: toArray(precedents).map(normalizePrecedent),
            actions: toArray(embeddedActions).map(function (action) {
                return normalizeAction(action, []);
            }),
            raw: row
        };
    }

    function normalizeAction(row, reports) {
        const reportId = String(pick(row, ["report_id", "reportId", "safety_report_id"]) || "");
        const trackingToken = String(pick(row, ["tracking_token", "tracking_id", "report_tracking_token"]) || "");
        const report = reports.find(function (item) {
            return item.id === reportId || item.trackingToken === trackingToken;
        }) || {};
        const noteDetails = parseActionNote(row.note || "");

        return {
            id: String(pick(row, ["id", "uuid", "action_id"]) || ""),
            reportId: reportId || report.id || "",
            trackingToken: trackingToken || report.trackingToken || "Not available",
            description: String(pick(row, ["description", "action_description", "action", "title"]) || noteDetails.description || row.note || "Not available"),
            assignedTo: String(pick(row, ["assigned_to", "owner", "assignee"]) || noteDetails.assignedTo || "Not assigned"),
            dueDate: String(pick(row, ["due_date", "target_date", "deadline"]) || noteDetails.dueDate || ""),
            priority: normalizePriority(pick(row, ["priority", "severity"]) || noteDetails.priority),
            status: normalizeActionStatus(pick(row, ["status", "action_status"])),
            verificationRequired: Boolean(pick(row, ["verification_required", "needs_verification"]) || noteDetails.verificationRequired || false),
            site: String(pick(row, ["site", "site_name"]) || report.site || "Not available"),
            area: String(pick(row, ["area", "area_name"]) || report.area || "Not available"),
            reportDescription: report.description || "",
            raw: row
        };
    }

    function parseActionNote(note) {
        const details = {};

        String(note || "").split("\n").forEach(function (line) {
            const parts = line.split(":");
            const key = parts.shift();
            const value = parts.join(":").trim();

            if (!key || !value) {
                return;
            }

            const normalized = normalizeToken(key);

            if (normalized === "action_assigned") {
                details.description = value;
            } else if (normalized === "assigned_to") {
                details.assignedTo = value;
            } else if (normalized === "due_date") {
                details.dueDate = value;
            } else if (normalized === "priority") {
                details.priority = value;
            } else if (normalized === "verification_required") {
                details.verificationRequired = normalizeToken(value) === "yes";
            }
        });

        return details;
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

        return new Date(b.receivedAt || 0) - new Date(a.receivedAt || 0);
    }

    async function assignCorrectiveAction(report, values) {
        const config = getConfig();

        if (!store.client) {
            throw new Error("Supabase is not connected.");
        }

        if (!config.tables.actions) {
            throw new Error("No action/status-event table is configured in supabase-config.js.");
        }

        const actionPayload = buildActionPayload(report, values, config.tables.actions);

        const insertResponse = await store.client
            .from(config.tables.actions)
            .insert(actionPayload)
            .select()
            .single();

        if (insertResponse.error) {
            throw new Error(insertResponse.error.message);
        }

        await markReportActionAssigned(report, config.updateTables && config.updateTables.reports
            ? config.updateTables.reports
            : config.tables.reports);
        await refreshAll();

        return insertResponse.data;
    }

    function buildActionPayload(report, values, tableName) {
        if (tableName === "report_status_events") {
            return {
                report_id: report.id,
                status: "action_assigned",
                note: [
                    "Action assigned: " + values.description,
                    "Assigned to: " + values.assignedTo,
                    "Due date: " + values.dueDate,
                    "Priority: " + values.priority,
                    "Verification required: " + (values.verificationRequired ? "yes" : "no")
                ].join("\n"),
                created_by: "dashboard"
            };
        }

        return {
            report_id: report.id || null,
            tracking_token: report.trackingToken,
            description: values.description,
            assigned_to: values.assignedTo,
            due_date: values.dueDate,
            priority: normalizeToken(values.priority),
            status: "open",
            verification_required: Boolean(values.verificationRequired),
            site: report.site,
            area: report.area
        };
    }

    async function signOut() {
        if (!store.client) {
            const config = getConfig();
            const validationError = validateConfig(config);

            if (validationError) {
                throw new Error(validationError);
            }

            store.client = window.supabase.createClient(config.url, config.anonKey);
        }

        const response = await store.client.auth.signOut();

        if (response.error) {
            throw new Error(response.error.message);
        }

        store.reports = [];
        store.actions = [];
        store.initialized = false;
        localStorage.removeItem("sanketak_logged_in");
    }

    async function markReportActionAssigned(report, tableName) {
        if (!tableName) {
            return;
        }

        let query = store.client
            .from(tableName)
            .update({ status: "action_assigned" });

        if (report.id) {
            query = query.eq("id", report.id);
        } else {
            query = query.eq("tracking_token", report.trackingToken);
        }

        await query;
    }

    function getConnectionState() {
        return {
            initialized: store.initialized,
            configured: store.configured,
            loading: store.loading,
            error: store.error,
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
        return window.SanketakSupabaseConfig || {};
    }

    function validateConfig(config) {
        if (!window.supabase) {
            return "Supabase client library did not load. Check your internet connection or bundle @supabase/supabase-js locally.";
        }

        if (!config.url || config.url.includes("YOUR_PROJECT_REF")) {
            return "Add your Supabase project URL in supabase-config.js.";
        }

        if (!config.anonKey || config.anonKey.includes("YOUR_SUPABASE_ANON_KEY")) {
            return "Add your Supabase anon key in supabase-config.js.";
        }

        if (!config.tables || !config.tables.reports) {
            return "Add the worker reports table name in supabase-config.js.";
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

        if (["submitted", "new", "needs_review"].includes(normalized)) {
            return "submitted";
        }

        if (["under_review", "review", "reviewing"].includes(normalized)) {
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

        if (["open", "submitted", "new", "needs_review", "action_assigned", "assigned"].includes(normalized)) {
            return "open";
        }

        if (["in_progress", "progress", "under_review"].includes(normalized)) {
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

    function normalizeTrend(value) {
        const normalized = normalizeToken(value);
        return normalized.includes("increasing") || normalized.includes("up") ? "Increasing" : "Stable";
    }

    function normalizeConfidence(value) {
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

    function cap(value) {
        return String(value || "")
            .replace(/_/g, " ")
            .replace(/\b\w/g, function (letter) {
                return letter.toUpperCase();
            });
    }

    window.SanketakServices = {
        initialize,
        refreshAll,
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
        assignCorrectiveAction,
        signOut,
        priorityRank,
        lifecycleStatus,
        actionStatus
    };
})();
