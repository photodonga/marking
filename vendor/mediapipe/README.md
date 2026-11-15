# MediaPipe Tasks Vision (로컬 사본)

얼굴 자동 맞춤을 외부 서버 없이 쓰려고 저장소에 함께 둔 파일입니다.

- `vision_bundle.mjs`, `wasm/` — npm `@mediapipe/tasks-vision@0.10.35` (Apache-2.0)
- `models/blaze_face_full_range.tflite`, `models/face_landmarker.task` — Google MediaPipe 공개 모델 (Apache-2.0)

버전을 올릴 때는 `src/editor-app.js`의 `TASKS_VISION_VERSION`과 이 폴더를 함께 바꿉니다.
