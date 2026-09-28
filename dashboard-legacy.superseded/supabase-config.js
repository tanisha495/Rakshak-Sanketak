// Sanketak Supabase connection settings.
// Use the public anon key here, never the service-role key.

window.SanketakSupabaseConfig = {
    url: "https://xbbmpqohadyzqfowtems.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhiYm1wcW9oYWR5enFmb3d0ZW1zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyOTk5MzUsImV4cCI6MjEwNDg3NTkzNX0.EncPCmNKhgXIjW2Id5atCcmVHTHskanZR5NPcJkxU2U",
    tables: {
        reports: "employer_report_dashboard",
        actions: "report_status_events"
    },
    updateTables: {
        reports: "reports"
    },
    schema: "public",
    realtimeTables: [
        "reports",
        "report_analysis",
        "report_status_events"
    ],
    realtime: true
};
