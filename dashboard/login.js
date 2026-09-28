// Sanketak HSE staff login against the FastAPI backend.

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const rememberCheckbox = document.getElementById("remember");
const forgotPassword = document.getElementById("forgotPassword");

const config = window.SanketakConfig || {};
const auth = window.SanketakAuth;

togglePassword.addEventListener("click", function () {
    passwordInput.type = passwordInput.type === "password" ? "text" : "password";
});

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        alert("Please enter your email and password.");
        return;
    }

    if (!auth) {
        alert("Dashboard configuration did not load. Check supabase-config.js.");
        return;
    }

    const submitButton = loginForm.querySelector("button[type='submit']");
    const originalText = submitButton.textContent;

    submitButton.disabled = true;
    submitButton.textContent = "Signing in...";

    try {
        // The backend field is called `username`, but it authenticates on
        // email — so the email goes in it.
        const body = new URLSearchParams({
            grant_type: "password",
            username: email,
            password: password
        });

        const response = await fetch(auth.apiUrl("/auth/login"), {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString()
        });

        if (!response.ok) {
            alert(await readError(response));
            return;
        }

        const data = await response.json();

        if (!data.access_token) {
            alert("Login succeeded but no access token was returned.");
            return;
        }

        auth.setToken(data.access_token);

        if (rememberCheckbox.checked) {
            localStorage.setItem(config.emailKey, email);
        } else {
            localStorage.removeItem(config.emailKey);
        }

        window.location.href = config.dashboardPage || "dash.html";
    } catch (error) {
        alert("Could not reach the backend at " + config.apiBaseUrl + ". Is it running?");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
});

async function readError(response) {
    if (response.status === 401) {
        return "Invalid email or password.";
    }

    try {
        const data = await response.json();

        if (typeof data.detail === "string") {
            return data.detail;
        }

        if (Array.isArray(data.detail) && data.detail.length) {
            return data.detail[0].msg || "Login failed.";
        }
    } catch (error) {
        // Not JSON — fall through to the status text.
    }

    return "Login failed (" + response.status + ").";
}

const savedEmail = localStorage.getItem(config.emailKey);

if (savedEmail) {
    emailInput.value = savedEmail;
    rememberCheckbox.checked = true;
}

// Password reset is disabled: the backend has no reset endpoint. The link
// stays in the markup (the HTML is not ours to change), so it is neutralised
// here and told plainly why.
if (forgotPassword) {
    forgotPassword.setAttribute("aria-disabled", "true");

    forgotPassword.addEventListener("click", function (event) {
        event.preventDefault();
        alert("Password reset is not available. Ask an HSE administrator to reset your account.");
    });
}
