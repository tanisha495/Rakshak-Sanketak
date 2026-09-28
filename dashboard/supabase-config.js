// Sanketak dashboard backend settings.
// Filename kept as supabase-config.js because every page loads it by that
// name and the HTML is not ours to change. The contents are no longer
// Supabase — this is the FastAPI backend configuration.

// Where the backend lives. No trailing slash.
//
// The API serves these pages itself at /dashboard/, so when that is how you
// arrived, the backend is simply this origin -- which keeps working when the
// dashboard is opened from another machine on the LAN by its IP, where a
// hardcoded "localhost" would point the browser at itself and every request
// would fail. Opening the .html files directly from disk (file://) has no
// usable origin, so that case falls back to localhost.
const API_PORT = "8000";

function resolveApiBaseUrl() {
    // An explicit override always wins. Set window.SANKETAK_API_BASE_URL in a
    // <script> before this file to point the dashboard somewhere else.
    if (window.SANKETAK_API_BASE_URL) {
        return String(window.SANKETAK_API_BASE_URL).replace(/\/+$/, "");
    }

    const location = window.location;

    // Opened straight off disk (file://) -- no usable origin.
    if (!location || location.protocol.indexOf("http") !== 0) {
        return "http://localhost:" + API_PORT;
    }

    // Served by the API itself (http://host:8000/dashboard/): the backend is
    // this origin, which also keeps working when another machine opens it by
    // LAN IP, where a hardcoded "localhost" would mean that machine.
    if (location.port === API_PORT) {
        return location.origin.replace(/\/+$/, "");
    }

    // Served by anything else -- Live Server, a static server on :3000, or
    // any other port. The backend is not there, so keep the host and switch
    // to the API's port. Using the origin verbatim here made every request
    // 404 against whatever was serving the files.
    return location.protocol + "//" + location.hostname + ":" + API_PORT;
}

window.SanketakConfig = {
    apiBaseUrl: resolveApiBaseUrl(),

    // localStorage keys, in one place so nothing hardcodes a string.
    tokenKey: "sanketak_access_token",
    emailKey: "sanketak_email",

    // Where to send a visitor whose token is missing or rejected.
    loginPage: "login.html",
    dashboardPage: "dash.html"
};

// Token helper. Shared by login.js, hse-services.js and hse-app.js.
window.SanketakAuth = {
    getToken: function () {
        try {
            return localStorage.getItem(window.SanketakConfig.tokenKey) || "";
        } catch (error) {
            return "";
        }
    },

    setToken: function (token) {
        try {
            localStorage.setItem(window.SanketakConfig.tokenKey, token);
        } catch (error) {
            // Private browsing or blocked storage. The session simply will
            // not persist; the caller still has the token for this page.
        }
    },

    clearToken: function () {
        try {
            localStorage.removeItem(window.SanketakConfig.tokenKey);
        } catch (error) {
            // Nothing to clear.
        }
    },

    isSignedIn: function () {
        return Boolean(window.SanketakAuth.getToken());
    },

    // Authorization header for every authenticated request, or {} when
    // there is no token so the caller still gets a well-formed 401.
    authHeaders: function () {
        const token = window.SanketakAuth.getToken();
        return token ? { Authorization: "Bearer " + token } : {};
    },

    apiUrl: function (path) {
        return window.SanketakConfig.apiBaseUrl + path;
    }
};
