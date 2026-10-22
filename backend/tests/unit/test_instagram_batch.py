"""Unit tests for Instagram Batch CSV and JSON Import Service.

Tests:
1. CSV parsing with case-insensitive and alias header mapping.
2. JSON parsing for both bare arrays and enveloped {"posts": [...]} structures.
3. Strict metric preservation: missing or uncollected metrics remain None (never 0).
4. Duplicate detection against existing database records and intra-file duplicate rows.
5. Validation of required fields (source_url, caption, valid protocols).
6. Safe, idempotent commit operation with duplicate skipping.
7. Verification that batch commit creates a single versioned strategy checkpoint and updates learning state.
"""

from __future__ import annotations

import json
import os
import tempfile
import pytest

from app.schemas.api.instagram import (
    BatchImportCommitRequest,
    InstagramMetrics,
    InstagramObservationIn,
)
from app.services.instagram_batch import InstagramBatchService
from app.services.instagram_learning import InstagramLearningService


@pytest.fixture
def temp_batch_service():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test_batch.sqlite")
        svc = InstagramLearningService(db_path=db_path)
        yield svc


def test_csv_batch_preview_and_null_metrics_preservation(temp_batch_service):
    svc = temp_batch_service

    csv_data = (
        "url,creator,type,caption,likes,views,comments,saves\n"
        "https://www.instagram.com/reel/post1,@dev_tips,reel,Stop writing bad SQL queries!,450,12000,32,180\n"
        "https://www.instagram.com/p/post2,@dev_tips,carousel,5 system design lessons.,300,,15,\n"
        "https://www.instagram.com/p/post3,@dev_tips,photo,Clean code habits.,,,,\n"
    ).encode("utf-8")

    preview = InstagramBatchService.parse_raw_content(
        content_bytes=csv_data,
        filename="posts_export.csv",
        service=svc,
    )

    assert preview.total_rows == 3
    assert preview.valid_count == 3
    assert preview.duplicate_count == 0
    assert preview.invalid_count == 0
    assert preview.can_commit is True

    # Row 1: All metrics supplied
    r1 = preview.items[0]
    assert r1.status == "valid"
    assert r1.format == "reel"
    assert r1.metrics.likes == 450
    assert r1.metrics.views == 12000
    assert r1.metrics.comments == 32
    assert r1.metrics.saves == 180

    # Row 2: Partial metrics (views and saves omitted)
    r2 = preview.items[1]
    assert r2.status == "valid"
    assert r2.format == "carousel"
    assert r2.metrics.likes == 300
    assert r2.metrics.comments == 15
    assert r2.metrics.views is None  # Strict check: never 0!
    assert r2.metrics.saves is None  # Strict check: never 0!

    # Row 3: All metrics empty
    r3 = preview.items[2]
    assert r3.status == "valid"
    assert r3.format == "image"
    assert r3.metrics.likes is None
    assert r3.metrics.views is None
    assert r3.metrics.comments is None
    assert r3.metrics.saves is None


def test_json_batch_preview_enveloped_and_bare_array(temp_batch_service):
    svc = temp_batch_service

    json_enveloped = json.dumps({
        "posts": [
            {
                "permalink": "https://www.instagram.com/reel/json1",
                "post_text": "Why your Docker build is slow #DevOps",
                "media_type": "video",
                "likes_count": 890,
                "video_views": 45000,
            },
            {
                "permalink": "https://www.instagram.com/p/json2",
                "post_text": "Slide 1: Kubernetes networking explained #K8s",
                "media_type": "carousel",
                "likes_count": 620,
            },
        ]
    }).encode("utf-8")

    preview = InstagramBatchService.parse_raw_content(
        content_bytes=json_enveloped,
        filename="archive.json",
        service=svc,
    )

    assert preview.total_rows == 2
    assert preview.valid_count == 2
    assert preview.items[0].format == "reel"
    assert preview.items[0].metrics.likes == 890
    assert preview.items[0].metrics.views == 45000
    assert preview.items[1].format == "carousel"
    assert preview.items[1].metrics.views is None


def test_duplicate_detection_against_db_and_intra_file(temp_batch_service):
    svc = temp_batch_service

    # Ingest 1 existing post in DB
    svc.ingest_observation(
        InstagramObservationIn(
            source_url="https://www.instagram.com/reel/existing_in_db",
            format="reel",
            caption="Already in database",
            collection_method="manual_entry",
        )
    )

    # Prepare CSV containing:
    # Row 1: Fresh post
    # Row 2: Duplicate of DB post
    # Row 3: Duplicate of Row 1 (intra-file duplicate)
    csv_data = (
        "url,caption,format\n"
        "https://www.instagram.com/reel/fresh_post,Fresh new post,reel\n"
        "https://www.instagram.com/reel/existing_in_db,Already in database,reel\n"
        "https://www.instagram.com/reel/fresh_post,Exact copy of row 1,reel\n"
    ).encode("utf-8")

    preview = InstagramBatchService.parse_raw_content(
        content_bytes=csv_data,
        filename="duplicates_test.csv",
        service=svc,
    )

    assert preview.total_rows == 3
    assert preview.valid_count == 1
    assert preview.duplicate_count == 2
    assert preview.invalid_count == 0

    assert preview.items[0].status == "valid"

    # Row 2 was in DB
    assert preview.items[1].status == "duplicate"
    assert any("already exists in database" in r for r in preview.items[1].reasons)

    # Row 3 was repeated in the uploaded batch
    assert preview.items[2].status == "duplicate"
    assert any("within uploaded file" in r for r in preview.items[2].reasons)


def test_invalid_rows_and_malformed_files(temp_batch_service):
    svc = temp_batch_service

    # Row with missing URL and row with missing caption
    csv_data = (
        "url,caption\n"
        ",Valid caption without url\n"
        "not_a_valid_url,Valid caption\n"
        "https://www.instagram.com/p/valid,Valid caption text\n"
    ).encode("utf-8")

    preview = InstagramBatchService.parse_raw_content(
        content_bytes=csv_data,
        filename="invalid_test.csv",
        service=svc,
    )

    assert preview.total_rows == 3
    assert preview.valid_count == 1
    assert preview.invalid_count == 2
    assert preview.items[0].status == "invalid"
    assert preview.items[1].status == "invalid"
    assert preview.items[2].status == "valid"

    # Malformed JSON
    bad_json = b"{ invalid json content }"
    bad_preview = InstagramBatchService.parse_raw_content(
        content_bytes=bad_json,
        filename="bad.json",
        service=svc,
    )
    assert bad_preview.can_commit is False
    assert bad_preview.invalid_count == 1


def test_commit_batch_import_atomic_and_idempotent(temp_batch_service):
    svc = temp_batch_service

    csv_data = (
        "url,caption,format,likes,saves\n"
        "https://www.instagram.com/p/batch1,Post 1,carousel,100,50\n"
        "https://www.instagram.com/p/batch2,Post 2,reel,200,80\n"
    ).encode("utf-8")

    preview = InstagramBatchService.parse_raw_content(
        content_bytes=csv_data,
        filename="batch_commit.csv",
        service=svc,
    )
    valid_observations = [p.parsed_observation for p in preview.items if p.parsed_observation]
    assert len(valid_observations) == 2

    # Commit the batch
    commit_req = BatchImportCommitRequest(
        items=valid_observations,
        provenance_label="Monthly archive Q3",
        skip_duplicates=True,
    )
    resp = InstagramBatchService.commit_batch_import(commit_req, service=svc)

    assert resp.imported_count == 2
    assert resp.skipped_count == 0
    assert resp.strategy_version >= 1

    # Verify observations in database
    db_posts = svc.list_observations(limit=50)
    assert len(db_posts) == 2
    assert "Monthly archive Q3" in (db_posts[0].provenance_notes or "")

    # Verify strategy history has the batch import checkpoint
    history = svc.get_strategy_history()
    assert any("Batch dataset import" in h.change_summary for h in history)

    # Retry the exact same commit: should be idempotent and skip all 2 duplicates
    retry_resp = InstagramBatchService.commit_batch_import(commit_req, service=svc)
    assert retry_resp.imported_count == 0
    assert retry_resp.skipped_count == 2

    # Verify no duplicate records were added
    assert len(svc.list_observations(limit=50)) == 2
