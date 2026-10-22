"""End-to-end integration test against the live running Insight Agent local services.

Tests the full automated loop without requiring manual user interaction:
1. System health and ready probes (DuckDuckGo & Ollama).
2. JWT Authentication.
3. Report presentation: executive summary, distinct sources, verification ledger.
4. Instagram observation ingestion with strict null-metric preservation.
5. Pattern extraction: format & hook breakdown.
6. Actionable recommendations with full 7-point explanation structure.
7. User feedback adaptation loop (rejecting a recommendation updates active strategy).
8. Versioned strategy profile checkpointing and rollback.
9. Level B Self-improvement proposals review and diff inspection.
"""

import uuid
import httpx
import pytest

BASE_URL = "http://127.0.0.1:8000"


def test_e2e_full_live_system_workflow():
    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    # 1. Health & Dependency Readiness
    r = client.get("/health/ready")
    assert r.status_code == 200, f"Health check failed: {r.text}"
    health_data = r.json()
    assert health_data.get("status") == "ready"
    assert health_data.get("duckduckgo") == "ready"

    # 2. Authentication
    auth_resp = client.post(
        "/api/v1/auth/token",
        data={"username": "admin", "password": "admin123"},
    )
    assert auth_resp.status_code == 200, f"Auth failed: {auth_resp.text}"
    token = auth_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Report Presentation & Evidence Verification
    reports_resp = client.get("/api/v1/reports", headers=headers)
    assert reports_resp.status_code == 200
    report_items = reports_resp.json().get("items", [])
    assert len(report_items) >= 1

    rep_id = report_items[0]["id"]
    detail_resp = client.get(f"/api/v1/reports/{rep_id}", headers=headers)
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["metrics"]["unique_sources_count"] >= 1
    assert detail["metrics"]["unique_domains_count"] >= 1
    assert detail["executive_summary"] is not None
    assert len(detail["executive_summary"]) > 0

    # 4. Instagram Data Ingestion & Null-Metric Preservation
    ingest_payload = {
        "source_url": "https://www.instagram.com/reel/DEMO_AUTONOMOUS_TEST",
        "account_handle": "@tech_intelligence",
        "format": "reel",
        "caption": "Why you should never deploy on Friday afternoon without integration tests.\n#DevOps #Testing",
        "hook": "Why you should never deploy on Friday afternoon without integration tests.",
        "collection_method": "manual_entry",
        "provenance_notes": "Autonomous integration verification test post",
        "metrics": {
            "views": None,
            "likes": 420,
            "comments": 35,
            "shares": None,
            "saves": None,
        },
    }
    ingest_resp = client.post("/api/v1/instagram/ingest", json=ingest_payload, headers=headers)
    assert ingest_resp.status_code == 201, f"Ingest failed: {ingest_resp.text}"
    ingested_posts = ingest_resp.json()
    assert len(ingested_posts) == 1
    post = ingested_posts[0]
    assert post["metrics"]["likes"] == 420
    assert post["metrics"]["views"] is None  # Strict verification: views must remain None, not 0!
    assert post["metrics"]["saves"] is None  # Strict verification: saves must remain None!

    # 5. Pattern Extraction
    patterns_resp = client.get("/api/v1/instagram/patterns", headers=headers)
    assert patterns_resp.status_code == 200
    patterns = patterns_resp.json()
    assert patterns["total_observations"] >= 1
    assert len(patterns["formats"]) >= 1
    assert len(patterns["hook_types"]) >= 1

    # 6. Actionable Prioritized Recommendations & 7-Point Structure
    recs_resp = client.get("/api/v1/instagram/recommendations", headers=headers)
    assert recs_resp.status_code == 200
    recs = recs_resp.json()
    assert len(recs) >= 1
    for rec in recs:
        assert rec["what_to_do"]
        assert rec["why_recommended"]
        assert rec["supporting_evidence"]
        assert rec["confidence_and_limitations"]
        assert rec["expected_outcome"]
        assert rec["measurement_plan"]
        assert rec["contingency_plan"]
        assert rec["priority"] in ("high", "medium", "low")

    # 7. User Feedback Loop: Rejection of Recommendation
    target_rec = recs[0]
    fb_payload = {
        "target_id": target_rec["id"],
        "target_type": "recommendation",
        "action": "rejected",
        "user_note": "Autonomous QA rejection test",
    }
    fb_resp = client.post("/api/v1/instagram/feedback", json=fb_payload, headers=headers)
    assert fb_resp.status_code == 201

    updated_recs_resp = client.get("/api/v1/instagram/recommendations", headers=headers)
    assert updated_recs_resp.status_code == 200
    updated_rec_ids = [r["id"] for r in updated_recs_resp.json()]
    assert target_rec["id"] not in updated_rec_ids

    # Restore recommendation so subsequent test runs remain idempotent
    restore_resp = client.post(
        "/api/v1/instagram/feedback",
        json={
            "target_id": target_rec["id"],
            "target_type": "recommendation",
            "action": "accepted",
            "user_note": "Autonomous QA restoration",
        },
        headers=headers,
    )
    assert restore_resp.status_code == 201

    # 8. Versioned Strategy Profile History & Rollback
    history_resp = client.get("/api/v1/instagram/strategy/history", headers=headers)
    assert history_resp.status_code == 200
    history = history_resp.json()
    assert len(history) >= 2
    assert history[0]["version"] > history[1]["version"]

    # Test Rollback to earlier checkpoint
    rollback_target_ver = history[1]["version"]
    rb_resp = client.post(f"/api/v1/instagram/strategy/rollback/{rollback_target_ver}", headers=headers)
    assert rb_resp.status_code == 200
    rolled_back_profile = rb_resp.json()
    assert rolled_back_profile["version"] >= 1

    # 9. Level B: Self-Improvement Proposals & Explicit Review
    proposals_resp = client.get("/api/v1/instagram/proposals", headers=headers)
    assert proposals_resp.status_code == 200
    proposals = proposals_resp.json()
    assert len(proposals) >= 1
    test_proposal = proposals[0]
    assert test_proposal["candidate_patch_diff"]
    assert test_proposal["verification_plan"]
    assert test_proposal["risk_level"] in ("low", "medium", "high")

    # Review Proposal: Approve
    review_resp = client.post(
        f"/api/v1/instagram/proposals/{test_proposal['id']}/review",
        json={"action": "APPROVED", "review_notes": "Autonomous integration verification approval"},
        headers=headers,
    )
    assert review_resp.status_code == 200
    reviewed_prop = review_resp.json()
    assert reviewed_prop["status"] in ("APPROVED", "APPLIED")
    assert reviewed_prop["reviewed_at"] is not None

    # 10. Batch CSV Import Preview & Commit Workflow
    batch_tag = uuid.uuid4().hex[:8]
    unique_batch_url = f"https://www.instagram.com/reel/BATCH_E2E_{batch_tag}"
    csv_bytes = (
        f"url,creator,type,caption,likes,views,saves\n"
        f"{unique_batch_url},@e2e_tester,reel,Autonomous testing pipeline in action,950,,310\n"
        f"https://www.instagram.com/reel/DEMO_AUTONOMOUS_TEST,@tech_intelligence,reel,Duplicate from step 4,420,,\n"
    ).encode("utf-8")

    preview_resp = client.post(
        "/api/v1/instagram/batch/preview",
        files={"file": ("e2e_batch.csv", csv_bytes, "text/csv")},
        headers=headers,
    )
    assert preview_resp.status_code == 200, f"Batch preview failed: {preview_resp.text}"
    p_data = preview_resp.json()
    assert p_data["total_rows"] == 2
    assert p_data["valid_count"] == 1
    assert p_data["duplicate_count"] == 1
    assert p_data["can_commit"] is True

    valid_to_commit = [item["parsed_observation"] for item in p_data["items"] if item["status"] == "valid"]
    commit_resp = client.post(
        "/api/v1/instagram/batch/commit",
        json={
            "items": valid_to_commit,
            "provenance_label": "Live E2E Verification Batch",
            "skip_duplicates": True,
        },
        headers=headers,
    )
    assert commit_resp.status_code == 201, f"Batch commit failed: {commit_resp.text}"
    c_data = commit_resp.json()
    assert c_data["imported_count"] == 1
    assert c_data["skipped_count"] == 0

    # Verify committed observation in ledger with null metrics preserved
    obs_resp = client.get("/api/v1/instagram/observations?limit=10", headers=headers)
    assert obs_resp.status_code == 200
    all_obs = obs_resp.json()["items"]
    e2e_post = next((o for o in all_obs if o["source_url"] == unique_batch_url), None)
    assert e2e_post is not None
    assert e2e_post["metrics"]["likes"] == 950
    assert e2e_post["metrics"]["views"] is None
    assert e2e_post["metrics"]["saves"] == 310
    assert "Live E2E Verification Batch" in (e2e_post["provenance_notes"] or "")
