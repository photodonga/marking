# MARKING 유지보수용 코드 지도

> 기준: 2026-10-17, `index.html`(정식) 및 `test.html`(모듈형 개발). 실제 소스의 함수 이름을 기준으로 작성했습니다. 이 문서는 코드 수정 없이 개발팀의 탐색 비용을 줄이기 위한 안내입니다.

## 1. 실행 경로와 의존 관계

```text
정식 사용자: index.html (HTML + CSS + 인라인 JavaScript)
개발/검증:  test.html (동일한 HTML/CSS)
                ├─ src/editor-helpers.js (순수 계산/히스토리)
                ├─ src/editor-canvas.js  (Canvas 합성)
                └─ src/editor-app.js     (상태/DOM/입력/파일)
```

현재 두 실행 경로는 공존합니다. `test.html`의 모듈화를 이유로 `index.html`을 삭제하거나 단순히 대체해서는 안 됩니다. 배포 전 두 경로의 결과 동등성을 별도 확인해야 합니다.

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

1. **현재 동작 고정:** 정식/개발 자동 테스트 통과 상태를 기준점으로 태그 또는 커밋으로 기록.
2. **저장 로직 격리:** 사용자 동작이나 출력 바이트/픽셀을 바꾸지 않고 저장 함수의 입력·출력을 명확히 정의.
3. **편집 상태 정리:** 도구, 선택 객체, 효과, 히스토리 상태의 변경 경로를 일원화.
4. **포인터 처리 분리:** 화면 좌표 ↔ 원본 좌표 변환, 선택/드래그/완료 이벤트를 분리.
5. **UI 구성 분리:** `buildOptionsBar` 및 모바일 정렬 로직을 테스트 가능한 단위로 분해.
6. **CMS 적합성 평가:** DOM/CSS 충돌, CSP, 다운로드 권한, 이미지 파일 정책, 외부 모델 로딩 정책 확인.

순서는 권장안입니다. 실제 CMS 통합 요구사항에 따라 개발팀이 조정할 수 있습니다.

## 4. 검증 기준과 현재 한계

- GitHub Actions의 `MARKING browser regression`은 Node 단위 검사, 정식/개발 마크업·CSS 동등성, Chromium의 320·375·390·1280px 브라우저 회귀 검사를 수행합니다.
- 2026-10-17 **53번 실행**에서 모든 워크플로 단계가 성공했습니다: https://github.com/photodonga/marking/actions/runs/39011145066
- 이는 테스트된 시나리오의 통과를 의미합니다. Safari, iOS/Android 실기기, 고해상도 원본, 장시간 편집, 실제 CMS 내부 배포 및 사용자 수용 테스트까지 완료됐다는 의미는 아닙니다.
- 화면 구성/기능 수정과 내부 구조 개선은 별도 커밋으로 관리하고, 사용자 영향이 있는 변경은 개발팀과 사용자 승인 후 배포합니다.

## 5. 개발팀 첫 점검 제안

`docs/DEVELOPER_HANDOFF.md`의 실행/검증 절차를 따라 로컬에서 테스트를 재현하고, `src/editor-app.js`를 중심으로 파일 입출력·상태·DOM·렌더링의 경계를 검토하세요. 기존 정식 `index.html`을 기준으로 이미지 출력 결과와 모바일 조작을 비교한 뒤 모듈형 버전의 배포 여부를 결정하는 것이 안전합니다.

Copyright by 송은석. All Rights Reserved.
