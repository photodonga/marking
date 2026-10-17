# MARKING — 개발팀 인계 및 유지보수 안내

## 목적과 원칙
MARKING은 사진 위에 도형과 가림 효과 등을 적용하고 결과 이미지를 저장하는 브라우저 편집 도구입니다. 기존 사용자의 화면, 조작법, 결과물과 데이터 흐름을 보존하는 것이 리팩터링의 최우선 조건입니다. 이 문서는 CMS 통합 가능성을 보증하거나 실제 CMS 연동이 완료됐다는 뜻이 아닙니다.

## 배포와 개발 진입점
- `index.html`: 현재 사용자가 접근하는 정식 페이지. 단독 HTML 안에 CSS와 JavaScript가 포함되어 있으므로 수정 시 영향 범위가 큽니다.
- `test.html`: 모듈 분리 및 검증을 위한 개발 페이지. 정식 페이지와 HTML 마크업 및 CSS의 동등성을 자동 검사합니다.
- `src/editor-helpers.js`: 순수 계산·복제·효과 캐시·히스토리 보조 함수. 브라우저 `MarkingHelpers` 및 Node 테스트에서 사용합니다.
- `src/editor-canvas.js`: 원본 이미지 및 효과 레이어 합성 함수. 브라우저 `MarkingCanvas` 및 Node 테스트에서 사용합니다.
- `src/editor-app.js`: 편집 상태, 이벤트, 도구 옵션, 이미지 불러오기/저장, UI와 모듈 연결을 담당하는 컨트롤러. 추가 분리의 주요 대상입니다.

`test.html`의 스크립트 로드 순서는 **helpers → canvas → app**이며, 변경 시 의존성을 재검토해야 합니다. 현재 `index.html`은 모듈형 페이지로 교체하지 않았습니다. 따라서 두 진입점을 각각 검증해야 합니다.

## 검증
- `node tests/unit.cjs`: 순수 함수, 모듈 구문, 의존성 로드 순서.
- `node tests/production-parity.cjs`: 정식/개발 HTML 구조와 CSS 일치 검사.
- `tests/regression.html`: 브라우저에서 파일 로드, 도구, 모바일 옵션 레이아웃 등을 검사하는 하네스.
- `tests/run-browser-regression.cjs`: Playwright로 정식/개발 페이지를 320·375·390·1280px에서 검증하고, 캔버스 샘플 및 저장 파일을 검사.
- `.github/workflows/marking-regression.yml`: GitHub Actions 자동 검증. 실패 시 실행 로그와 `marking-browser-regression` 아티팩트의 `report.json` 및 스크린샷 확인.

로컬 브라우저 테스트 예시(프로젝트 루트에서):
```bash
node tests/unit.cjs
node tests/production-parity.cjs
npm install --no-save playwright@1.56.1
npx playwright install chromium
python3 -m http.server 8765 &
node tests/run-browser-regression.cjs
```
Playwright 설치, 실행 환경 및 OS에 따라 브라우저 추가 의존성이 필요할 수 있습니다. **테스트 성공은 모든 실사용 시나리오를 보증하지 않습니다.**

## 변경 시 필수 점검
1. 사진 로드, 확대/축소, 이동, 도형/선/화살표, 가림/모자이크, 색상·굵기·잠금, 실행 취소/다시 실행, 저장 형식과 화질을 회귀 검증합니다.
2. 모바일(특히 320px)에서 컨트롤 겹침, 터치 영역, 원/네모 전환 후 색상 팔레트 위치, 설정창 재생성 여부를 확인합니다.
3. 정식/개발 페이지 모두 검증하고, 차이가 발생하면 의도된 변경인지 기록합니다.
4. 실제 사진(가로/세로, 고해상도, EXIF 회전, 여러 효과 중첩)으로 출력 결과를 수동 검수합니다.
5. 사용자 데이터와 원본 이미지의 처리 경로, 외부 전송 여부, CMS 삽입 시 CSP·권한·파일 접근 정책을 개발팀에서 별도 검토합니다.

## 개발팀 판단이 필요한 사항
- 기존 CMS에서 외부 JS 로딩, 이미지 파일 접근, Canvas API, 다운로드 기능을 허용하는지.
- 기존 정식 단일 HTML 유지 vs 검증된 모듈형 진입점 전환 전략.
- 상태 관리/렌더링/파일 입출력의 추가 분리 범위와 오류 처리·접근성·성능 검증 기준.
- 배포 시 캐시 무효화, 버전 롤백, 브라우저 호환성, 실무 사용자 승인 절차.

## 변경 관리
사용자에게 영향을 주는 기능·레이아웃 변경은 리팩터링과 구분하여 기록합니다. 기존 파일을 무작정 교체하지 말고, 실패 시 이전 정상 커밋으로 되돌릴 수 있도록 Git 기록과 CI 아티팩트를 보존합니다.

Copyright by 송은석. All Rights Reserved.
