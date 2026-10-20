# MARKING — 개발팀 인계 및 유지보수 안내

## 목적과 원칙
MARKING은 사진 위에 도형과 가림 효과 등을 적용하고 결과 이미지를 저장하는 브라우저 편집 도구입니다. 이번 저장소 정리는 기능, UI, 출력 결과, 정식 페이지의 title 및 매니페스트를 변경하지 않습니다. 이 문서는 CMS 통합이나 연동 완료를 보증하지 않습니다.

## 배포와 개발 진입점
- `index.html`: **현재 정식 배포 페이지이자 유일한 편집기 진입점**. 이미 모듈형 JavaScript를 불러옵니다. 기존 title과 `marking-test.webmanifest` 참조는 의도적으로 유지합니다.
- `src/editor-helpers.js`: 순수 계산·복제·효과 캐시·히스토리 보조 함수. 브라우저 `MarkingHelpers` 및 Node 테스트에서 사용합니다.
- `src/editor-canvas.js`: 원본 이미지 및 효과 레이어 합성 함수. 브라우저 `MarkingCanvas` 및 Node 테스트에서 사용합니다.
- `src/editor-app.js`: 편집 상태, 이벤트, 도구 옵션, 이미지 불러오기/저장, UI와 모듈 연결을 담당하는 컨트롤러.

스크립트 로드 순서는 **helpers → canvas → app**입니다. 이전의 `test.html`은 정식 `index.html`과 바이트 단위로 동일해 별도 유지하지 않습니다.

## 검증
- `npm test`: 순수 함수·모듈 구문·의존성 로드 순서 및 정식 진입점 구조 검사.
- `tests/regression.html`: 정식 `index.html`을 대상으로 사진 로드, 도구, 모바일 옵션 레이아웃 등을 검사하는 브라우저 하네스.
- `npm run test:browser`: Playwright Chromium으로 320·375·390·1280px, 캔버스 샘플 및 저장 파일 검사.
- `npm run test:browser:webkit`: 같은 회귀 검사를 WebKit으로 수행 (Unix 계열 환경 기준).
- `.github/workflows/marking-regression.yml`: GitHub Actions 자동 검증. 실패 시 로그와 `marking-browser-regression` 아티팩트 확인.

로컬 브라우저 테스트 예시 (프로젝트 루트):
```bash
npm install
npx playwright install chromium webkit
npm test
python3 -m http.server 8765
# 별도 터미널
npm run test:browser
npm run test:browser:webkit
```
Playwright 설치 환경에 따라 OS 라이브러리가 추가로 필요할 수 있습니다. **테스트 성공은 모든 실사용 시나리오를 보증하지 않습니다.**

## 변경 시 필수 점검
1. 사진 로드, 확대/축소, 이동, 도형/선/화살표, 가림/모자이크, 색상·굵기·잠금, 실행 취소/다시 실행, 저장 형식과 화질을 회귀 검증합니다.
2. 모바일(특히 320px)에서 컨트롤 겹침, 터치 영역, 원/네모 전환 후 색상 팔레트 위치, 설정창 재생성 여부를 확인합니다.
3. 정식 `index.html`의 DOM·CSS·스크립트 로드 순서와 실제 사진 출력 결과를 확인합니다.
4. 실제 사진(가로/세로, 고해상도, EXIF 회전, 여러 효과 중첩)으로 출력 결과를 수동 검수합니다.
5. 사용자 데이터와 원본 이미지의 처리 경로, 외부 전송 여부, CMS 삽입 시 CSP·권한·파일 접근 정책을 개발팀에서 별도 검토합니다.

## 향후 분리 과제 — 이번 작업에서는 변경하지 않음
- `src/editor-app.js`는 약 118KB로 상태 변수(검토상 약 70개), UI 이벤트, 상태 관리, 렌더링 조정, 파일 입출력이 집중되어 있습니다.
- 향후 상태 관리 / UI 이벤트 / 이미지 입출력 / 렌더링 제어를 단계적으로 분리하되, 각 단계에서 실제 이미지 출력과 UI 회귀 테스트를 선행해야 합니다.
- 이번 정리에서는 해당 소스의 코드, 전역 상태, 실행 동작을 수정하지 않습니다.

## 개발팀 판단이 필요한 사항
- 기존 CMS에서 외부 JS 로딩, 이미지 파일 접근, Canvas API, 다운로드 기능을 허용하는지.
- 상태 관리/렌더링/파일 입출력 추가 분리 범위 및 접근성·성능 검증 기준.
- 배포 캐시 무효화, 버전 롤백, 브라우저 호환성, 실무 사용자 승인 절차.

## 변경 관리
과거 단일 HTML의 기준 커밋은 `7969ec975a06b5ca98f6ee05dce78ee65d699d51`입니다. 원본 백업의 Blob SHA와 해당 커밋의 `index.html` Blob SHA가 일치합니다. Git 태그 생성 및 백업 삭제는 태그 확인 후 수행합니다. 기존 파일을 무작정 교체하지 말고 Git 기록과 CI 아티팩트를 보존합니다.

Copyright by 송은석. All Rights Reserved.
