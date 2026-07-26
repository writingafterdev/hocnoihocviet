# Critical Writer Benchmark Importer

Chrome extension for extracting a YouPass assessment page and saving a MiMo reference assessment through the local app.

## Install locally

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this folder: `extension-benchmark`.

## Use

1. Open a YouPass assessment detail page.
2. Click the extension.
3. Wait for the extension badge:
   - `RUN` means scraping.
   - `QUE` means the essay was saved as a queued benchmark job.
   - `DB!` means the local API responded, but the queue response was unexpected.
   - `ERR` means scraping or the local API failed.

If you are on a YouPass list/results page, open one `Xem lại` detail page first, then click the extension. The extension no longer performs bulk collection from list pages.

The extension sends only the extracted question, essay, scores, and source URL to `http://localhost:3000/api/benchmark/reference-assessments`. The local app saves a queued job immediately. Run `npm run benchmark:worker -- --once` or `npm run benchmark:worker -- --poll` to process queued jobs with MiMo.

View imported jobs at `http://localhost:3000/benchmark`.

## Database setup

Set `APPWRITE_BENCHMARK_REFERENCE_COLLECTION_ID` to the Appwrite collection that stores benchmark jobs, and `APPWRITE_BENCHMARK_REFERENCE_RESULTS_COLLECTION_ID` to the collection that stores generated reference outputs.

Expected job attributes:

- `benchmark_id`
- `status`
- `created_at`
- `started_at`
- `completed_at`
- `source`
- `source_url`
- `external_scores_json`
- `question`
- `essay`
- `provider`
- `model`
- `usage_json`
- `duration_ms`
- `error_summary`
- `result_id`

Expected result attributes:

- `benchmark_id`
- `assessment_markdown`
- `filled_prompt`
- `created_at`

If the collection env vars are missing, enqueueing will fail. The extension does not hold long MiMo requests in the browser because Chrome Manifest V3 service workers can sleep during long network calls.

The external score source currently provides one combined `Coherence & Cohesion` score, so the generated prompt keeps that as source truth and provisionally copies it into separate `Coherence` and `Cohesion` lines for the reference output.
