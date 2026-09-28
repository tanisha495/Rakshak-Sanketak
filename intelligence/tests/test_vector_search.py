from intelligence.precedent.vector_search import vector_search


new_report = {
    "report_id": "NEW001",
    "activity": "ACT_MECH_MAINTENANCE",
    "hazard": "HAZ_MECHANICAL",
    "life_saving_rules": ["LSR_ENERGY"],
    "barrier_failures": [
        {
            "barrier": "BAR_ISOLATION_VERIFIED",
            "failure_mode": "FM_NOT_COMPLIED"
        }
    ]
}


results = vector_search(new_report)


print("POSTGRESQL VECTOR SEARCH RESULTS")
print("--------------------------------")

for result in results:
    print(result)