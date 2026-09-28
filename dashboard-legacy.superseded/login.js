// Sanketak Supabase Auth login.

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const rememberCheckbox = document.getElementById("remember");
const forgotPassword = document.getElementById("forgotPassword");

const config = window.SanketakSupabaseConfig || {};
const supabaseClient = window.supabase && config.url && config.anonKey
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

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

    if (!supabaseClient) {
        alert("Supabase is not configured. Check supabase-config.js.");
        return;
    }

    const submitButton = loginForm.querySelector("button[type='submit']");
    const originalText = submitButton.textContent;

    submitButton.disabled = true;
    submitButton.textContent = "Signing in...";

    const response = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    submitButton.disabled = false;
    submitButton.textContent = originalText;

    if (response.error) {
        alert(response.error.message);
        return;
    }

    localStorage.setItem("sanketak_logged_in", "true");

    if (rememberCheckbox.checked) {
        localStorage.setItem("sanketak_email", email);
    } else {
        localStorage.removeItem("sanketak_email");
    }

    window.location.href = "dash.html";
});

const savedEmail = localStorage.getItem("sanketak_email");

if (savedEmail) {
    emailInput.value = savedEmail;
    rememberCheckbox.checked = true;
}

forgotPassword.addEventListener("click", async function (event) {
    event.preventDefault();

    if (!supabaseClient) {
        alert("Supabase is not configured. Check supabase-config.js.");
        return;
    }

    const email = emailInput.value.trim();

    if (!email) {
        alert("Enter your email first, then request password reset.");
        return;
    }

    const response = await supabaseClient.auth.resetPasswordForEmail(email);

    if (response.error) {
        alert(response.error.message);
        return;
    }

    alert("Password reset email sent.");
});
