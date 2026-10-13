# 바른금융 상담 신청 기능 수정 패키지

## 현재 상태
- 기존 홈페이지 파일을 `public/`에 넣었습니다.
- `public/app.js`는 신청 버튼을 `/api/applications`로 전송하도록 바꿨습니다.
- `worker.js`는 입력값을 검사하고 D1 데이터베이스에 저장합니다.
- Telegram 알림은 설정 시 접수번호만 보냅니다(이름/전화번호 전송 안 함).
- **이 ZIP을 만든 것만으로 접수 기능이 운영 사이트에 배포된 것은 아닙니다.** Cloudflare D1 생성, `wrangler.jsonc`의 database_id 설정, 배포가 필요합니다.

## 설정 절차(컴퓨터에서 권장)
1. Cloudflare 대시보드에서 Workers & Pages → D1 SQL Database를 열고 `barun-finance-applications` 데이터베이스를 만듭니다.
2. 데이터베이스의 SQL 콘솔에서 `schema.sql` 내용을 실행합니다.
3. 데이터베이스 ID를 복사해 `wrangler.jsonc`의 `REPLACE_WITH_D1_DATABASE_ID`를 실제 ID로 바꿉니다.
4. Node.js와 Wrangler가 설치된 컴퓨터에서 이 폴더를 배포합니다: `npx wrangler deploy`
5. 배포된 사이트에서 테스트 신청을 하고 D1의 `applications` 테이블에 행이 저장되는지 확인합니다.

## Telegram(선택)
Cloudflare Worker Settings → Variables and Secrets에서 `TELEGRAM_BOT_TOKEN`과 `TELEGRAM_CHAT_ID`를 Secret/변수로 설정합니다. 봇 토큰은 코드나 공개 채팅에 붙여넣지 마세요. 알림에는 접수번호만 전송됩니다.

## 개인정보 주의
- 실제 공개 전 운영 주체, 개인정보 보유 기간, 문의처, 개인정보 처리방침을 확정해야 합니다.
- D1 데이터 접근 권한을 꼭 필요한 운영자에게만 부여하세요.
- 테스트 시 실제 타인의 이름/전화번호를 사용하지 마세요.
- 이 패키지는 기본 접수 저장을 구현하지만, 운영 전 접근권한·보유기간·삭제 절차·스팸 방지 검토가 필요합니다.
