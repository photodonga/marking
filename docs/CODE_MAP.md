# MARKING 유지보수용 코드 지도

> 기준: main `5c05e979af54c1e1f4f3e58ea032163f2147f826` (2026-10-17). `index.html`과 `test.html`은 바이트 단위로 동일하며, 두 페이지 모두 모듈형 JavaScript를 불러옵니다. 이 문서는 코드 수정 없이 개발팀의 탐색 비용을 줄이기 위한 안내입니다.

## 1. 실행 경로와 의존 관계

```text
정식 사용자: index.html (HTML + CSS + 외부 JS)
PWA 시작 URL: test.html (index.html과 바이트 동일)
  두 페이지 모두 순서대로 로드:
    ├─ src/editor-helpers.js (순수 계산/히스토리)
    ├─ src/editor-canvas.js  (Canvas 합성)
    └─ src/editor-app.js     (상태/DOM/입력/파일)
```

`marking-test.webmanifest`의 `start_url`이 `./test.html`이므로 현재는 `test.html`을 삭제하면 안 됩니다. `tests/production-parity.cjs`에서 두 파일의 바이트 동일성을 검증합니다. 서비스 워커 프리캐시 사용 여부는 저장소 검색상 확인되지 않았지만 기존 설치 환경은 별도 점검이 필요합니다.

## 2. 주요 함수별 탐색 지도

| 관심 기능 | 시작 함수 / 파일 | 유지보수 시 확인할 점 |
| --- | --- | --- |
| 사진 열기 | `loadImageFile`, `openImagePicker` / editor-app | 비동기 파일 로딩, 최신 요청 우선, 파일 타입, EXIF 방향 및 오류 처리 |
| 보기 영역 | `fitCanvas`, `applyViewTransform`, `setViewZoom`, `clampView` / editor-app | 원본 픽셀 좌표와 화면 좌표의 구분 |
| 편집 도구 전환 | `setActiveTool`, `buildOptionsBar` / editor-app | 활성 도구, 선택 상태, 모바일 옵션 DOM |
| 모바일 옵션 정렬 | `arrangeMobileOptions`, `alignMobileOptionLabels` / editor-app | 320/375/390px, 원·네모 전환 시 컨트롤 위치 |
| 포인터/터치 입력 | `onPointerDown`, `onPointerMove`, `onPointerUp`, `finishPointer` / editor-app | 포인터 캡처, 드래그 취소, 확대 상태에서 좌표 변환 |
| 도형 렌더링 | `drawObjectOnCtx`, `drawArrowShape`, `drawCircleShape` / editor-app | 선 굵기·색상·점선, 화면/저장 결과 동등성 |
| 화면 다시 그리기 | `redraw`, `doRedraw` / editor-app | requestAnimationFrame 배치와 비파괴 효과 표시 |
| 기본/효과 합성 | `drawBase`, `drawEffectLayer`, `composeEffectObject` / editor-canvas | 원본 보존, 여러 가림 효과의 합성 순서 |
| 히스토리 | `pushHistory`, `undo`, `redo`, `restoreHistoryEntry` / editor-app | 편집 객체/효과 객체 복제, 선택 상태 복원 |
| 히스토리 순수 로직 | `pushHistoryEntry`, `deepCloneObjects` / editor-helpers | 히스토리 최대 개수, 참조 공유로 인한 상태 오염 |
| 효과 캐시 | `effectCacheKey`, `pruneEffectCache` / editor-helpers | 편집 후 캐시 무효화, 오래된 이미지 메모리 정리 |
| 얼굴 감지 | `ensureFaceDetector`, `ensureFaceLandmarker`, `detectFacesPrimary` / editor-app | 런타임 다운로드 실패, 비동기 경쟁 상태, 수동 작업 대체 경로 |

저장/내보내기 로직은 현재 `editor-app.js`의 이벤트 처리부와 연계돼 있으므로, 추후 별도 모듈로 분리할 때 **원본 이미지의 크기·화질·파일 형식·주석 렌더링 순서**를 반드시 비교해야 합니다.

## 3. 추가 리팩터링 권장 순서

1. **현재 동작 고정:** 정식/PWA 자동 테스트 및 고정 fixture 비교를 통과하는 상태를 기준점으로 기록.
2. **저장 로직 격리:** 사용자 동작이나 출력 바이트/픽셀을 바꾸지 않고 저장 함수의 입력·출력을 명확히 정의.
3. **편집 상태 정리:** 도구, 선택 객체, 효과, 히스토리 상태의 변경 경로를 일원화.
4. **포인터 처리 분리:** 화면 좌표 ↔ 원본 좌표 변환, 선택/드래그/완료 이벤트를 분리.
5. **UI 구성 분리:** `buildOptionsBar` 및 모바일 정렬 로직을 테스트 가능한 단위로 분해.
6. **PWA 진입점 이전:** `marking-test.webmanifest`의 `start_url`을 `index.html`로 이전하고 설치/업데이트/기존 홈 화면 바로가기를 검증한 후에만 중복 `test.html` 삭제 검토.
7. **CMS 적합성 평가:** DOM/CSS 충돌, CSP, 다운로드 권한, 이미지 파일 정책, 외부 모델 로딩 정책 확인.

순서는 권장안입니다. 실제 CMS 통합 요구사항에 따라 개발팀이 조정할 수 있습니다.

## 4. 검증 기준과 fixture 갱신 절차

- 정적 검사: `scripts/check-test.mjs`가 핵심 컨트롤·함수 존재, JS 구문, CSS 중괄호 균형을 검사합니다. **중괄호 균형은 최소 구문 검사일 뿐 UI 불변의 증거가 아닙니다.**
- 바이트 일치: `tests/production-parity.cjs`가 `index.html`과 `test.html`을 직접 비교합니다.
- UI 기준: `tests/fixtures/ui-main.json`에는 main 커밋 SHA와 CSS·마크업 FNV-1a 64-bit 해시가 저장됩니다. `tests/check-ui-fixtures.cjs`는 변경 여부를 확인하고 CI에서 fixture SHA와 브랜치의 `git merge-base HEAD origin/main`을 비교합니다.
- 브라우저 회귀: Chromium과 WebKit, 320·375·390·1280px에서 두 진입점의 동작, 캔버스 픽셀 16×16 RGBA 샘플 및 검사 항목을 대조합니다.
- **화면별 픽셀 기준값과 검사 이름 목록은 `tests/fixtures/browser-main.json`에 보관합니다(생성·리뷰 후 커밋 필요).** main과 동일한 Ubuntu runner 및 Playwright 1.56.1에서 수집해야 하며, 확보 전에는 별도 fixture 고정 검사가 완료됐다고 주장해서는 안 됩니다.
- 픽셀 허용 오차: 동일 Linux runner·브라우저 버전·입력 이미지·viewport 기준에서는 우선 **채널당 오차 0(정확히 일치)**를 목표로 합니다. 엔진/폰트 차이가 확인되면 원인 분석과 실제 이미지 품질 영향 검토 후 리뷰를 거쳐서만 허용 오차를 도입합니다. Chromium 기준값을 WebKit에 재사용하지 않습니다.

**기준값 갱신은 반드시 수동으로 리뷰·커밋합니다.** 변경을 리뷰한 후 기준 main 커밋 SHA를 확정하고, 별도 `git worktree`에 해당 SHA를 체크아웃합니다. 생성 스크립트는 `git rev-parse HEAD`가 지정 SHA와 일치하는지 확인해야 합니다. CI와 같은 Ubuntu 및 고정 Playwright 버전에서 화면 폭별 결과를 생성하고, fixture에 원본 SHA·브라우저 엔진·버전·화면 폭·검사 이름과 순서·RGBA 샘플을 기록합니다. 생성 도구 `scripts/generate-ui-baseline.cjs`는 Linux에서만 실행되고, worktree의 HEAD와 지정한 40자리 main SHA가 다르면 중단합니다. 동일 환경에서 브라우저 회귀 테스트가 생성한 `test-results/report-chromium.json`, `report-webkit.json`을 읽어 fixture를 만들며, 기존 fixture 파일을 덮어쓰지 않습니다. GitHub Actions의 `baseline-fixtures` 작업은 main의 별도 worktree에서 생성한 파일을 아티팩트로만 업로드합니다. 아티팩트를 검토한 후 수동으로 `tests/fixtures/browser-main.json`에 커밋해야 합니다. 결과 파일 변경은 별도 PR 리뷰가 필요하며 일반 테스트 실행 시 자동 덮어쓰지 않습니다. main의 merge-base가 바뀌면 fixture 갱신과 리뷰를 다시 해야 합니다.

실기기 Safari, Android, EXIF 회전, 고해상도 원본, 장시간 편집 및 CMS 내 배포는 별도 수동 검증이 필요합니다.

## 5. 개발팀 첫 점검 제안

`docs/DEVELOPER_HANDOFF.md`의 실행/검증 절차를 따라 로컬에서 테스트를 재현하고, `src/editor-app.js`를 중심으로 파일 입출력·상태·DOM·렌더링의 경계를 검토하세요. 현재 두 페이지가 이미 모듈형이므로 정식 `index.html`과 PWA `test.html`의 동작 및 출력 결과가 일치하는지 먼저 확인하세요.

Copyright by 송은석. All Rights Reserved.
