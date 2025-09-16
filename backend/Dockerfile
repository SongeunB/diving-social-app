# Node.js 18 버전의 경량화된 Alpine Linux 이미지 사용
FROM node:18-alpine

# 컨테이너 내부 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 먼저 복사
# (의존성 설치는 소스코드 변경과 무관하므로 캐시 최적화)
COPY package*.json ./

# 개발 환경 의존성 포함해서 설치
RUN npm install --include=dev

# 나머지 소스 코드 복사
COPY . .

# 컨테이너가 5000번 포트를 사용한다고 문서화
EXPOSE 5000

# 개발 모드로 서버 실행
CMD ["npm", "run", "dev"]