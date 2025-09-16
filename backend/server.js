// ============================================
// 📦 필요한 패키지들을 불러오기
// ============================================
const express = require('express');  // Express 웹 프레임워크
const cors = require('cors');        // CORS 정책 해결 (브라우저 보안)
const helmet = require('helmet');    // 보안 강화 (HTTP 헤더 설정)
const morgan = require('morgan');    // HTTP 요청 로그 기록
require('dotenv').config();          // .env 파일의 환경변수 로드

// 🗄️ Supabase 클라이언트 불러오기
const { supabase, testConnection, getDatabaseInfo } = require('./utils/supabase');
// ============================================
// 🚀 Express 앱 초기화
// ============================================
const app = express();
const PORT = process.env.PORT || 8000;  // 환경변수에서 포트 가져오기 (기본값: 8000)

// 🆕 환경변수 추가 활용
const APP_NAME = process.env.APP_NAME || 'Diving Social API';
const NODE_ENV = process.env.NODE_ENV || 'development';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ============================================
// 🛡️ 보안 및 기본 미들웨어 설정
// ============================================

// Helmet: 보안을 위한 HTTP 헤더 설정
app.use(helmet({
  crossOriginEmbedderPolicy: false,  // CORS 관련 설정 완화
}));

// CORS: 다른 도메인에서의 API 호출 허용 (프론트엔드에서 백엔드 API 호출 가능, 환경변수 활용)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://frontend:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

// Morgan: HTTP 요청 로그 기록 (개발 시 요청 추적에 유용)
app.use(morgan('combined'));

// Body Parser: JSON 및 URL-encoded 데이터 파싱
app.use(express.json({ limit: '10mb' }));           // JSON 형태 요청 본문 파싱
app.use(express.urlencoded({ extended: true }));    // 폼 데이터 파싱

// ============================================
// 📍 기본 라우트 설정
// ============================================

// 🏠 홈 라우트 - API 서버 상태 확인 (Supabase 상태 추가)
app.get('/', async (req, res) => {
  try {
    // 🗄️ Supabase 연결 상태 확인
    const dbInfo = await getDatabaseInfo();
    
    res.status(200).json({
      message: `🌊 ${APP_NAME}`,
      version: '1.0.1',
      environment: NODE_ENV,
      status: 'running perfectly!',
      timestamp: new Date().toISOString(),
      config: {
        port: PORT,
        cors_origins: allowedOrigins,
        jwt_expires: process.env.JWT_EXPIRES_IN || 'not set'
      },
      database: {
        provider: 'Supabase',
        connected: dbInfo.connected,
        url: process.env.SUPABASE_URL ? 'configured' : 'not configured',
        ...(dbInfo.connected && { version: dbInfo.version })
      },
      endpoints: {
        health: '/health',
        api: '/api/*',
        db_test: '/db-test'
      }
    });
  } catch (error) {
    console.error('❌ 홈 라우트 에러:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '서버 상태 확인 중 오류가 발생했습니다.'
    });
  }
});

// 🗄️ 데이터베이스 연결 테스트 라우트
app.get('/db-test', async (req, res) => {
  try {
    console.log('🔍 데이터베이스 연결 테스트 시작...');
    
    // 1. 기본 연결 테스트
    const connectionTest = await testConnection();
    
    // 2. 데이터베이스 정보 조회
    const dbInfo = await getDatabaseInfo();
    
    // 3. 간단한 쿼리 테스트 (존재하지 않는 테이블이어도 괜찮음)
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('*')
      .limit(1);
    
    res.json({
      message: '🗄️ 데이터베이스 연결 테스트 결과',
      tests: {
        basic_connection: {
          status: connectionTest ? 'success' : 'failed',
          description: 'Supabase 기본 연결 테스트'
        },
        database_info: {
          status: dbInfo.connected ? 'success' : 'failed',
          data: dbInfo,
          description: 'PostgreSQL 버전 및 상태 확인'
        },
        query_test: {
          status: testError ? 'expected_fail' : 'success',
          error: testError?.message || null,
          description: '간단한 SELECT 쿼리 테스트 (테이블이 없어도 정상)'
        }
      },
      supabase_config: {
        url: process.env.SUPABASE_URL ? 'configured' : 'missing',
        anon_key: process.env.SUPABASE_ANON_KEY ? 'configured' : 'missing',
        service_key: process.env.SUPABASE_SERVICE_KEY ? 'configured' : 'missing'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ DB 테스트 에러:', error);
    res.status(500).json({
      error: 'Database Test Failed',
      message: error.message,
      supabase_config: {
        url: process.env.SUPABASE_URL ? 'configured' : 'missing',
        anon_key: process.env.SUPABASE_ANON_KEY ? 'configured' : 'missing',
        service_key: process.env.SUPABASE_SERVICE_KEY ? 'configured' : 'missing'
      }
    });
  }
});

// 🏥 헬스 체크 라우트 - 서버 상태 모니터링용
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),  // 서버 실행 시간
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage()  // 메모리 사용량
  });
});

// ============================================
// 🛣️ API 라우트 설정 (나중에 추가할 예정)
// ============================================

// 예시: 향후 추가할 라우트들
app.use('/api/auth', require('./routes/auth'));     // 인증 관련
app.use('/api/users', require('./routes/users'));   // 사용자 관련  
app.use('/api/dives', require('./routes/dives'));   // 다이빙 기록 관련

// 📝 임시 API 엔드포인트들 (테스트용)
app.get('/api/test', (req, res) => {
  res.json({
    message: 'API 테스트 성공! 🎉',
    data: {
      diving_types: ['Free Diving', 'Scuba Diving'],
      features: ['로그북', '커뮤니티', '사진 갤러리']
    }
  });
});

// 🆕 새로운 엔드포인트 추가
app.get('/api/diving-spots', (req, res) => {
  res.json({
    message: 'nodemon 테스트용 새 엔드포인트! 🏝️',
    spots: [
      { name: '제주도 서귀포', depth: '15m', visibility: 'good' },
      { name: '울릉도 촛대바위', depth: '25m', visibility: 'excellent' },
      { name: '강릉 사근진해변', depth: '10m', visibility: 'fair' }
    ],
    created_at: new Date().toISOString()
  });
});

// ============================================
// ❌ 에러 핸들링 미들웨어
// ============================================

// 404 에러 처리 - 존재하지 않는 라우트 접근 시
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `경로 '${req.originalUrl}'을 찾을 수 없습니다.`,
    available_endpoints: ['/', '/health', '/api/test']
  });
});

// 500 에러 처리 - 서버 내부 오류 처리
app.use((err, req, res, next) => {
  console.error('❌ 서버 에러:', err.stack);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: '서버에서 오류가 발생했습니다.',
    // 개발 환경에서만 에러 상세 정보 노출
    ...(process.env.NODE_ENV === 'development' && { 
      details: err.message,
      stack: err.stack 
    })
  });
});

// ============================================
// 🚀 서버 시작 (환경변수 활용)
// ============================================
app.listen(PORT, '0.0.0.0', async () => {
  console.log('\n🎉 ====================================');
  console.log(`🌊 ${APP_NAME} Started!`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${NODE_ENV}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`🎯 Frontend: ${FRONTEND_URL}`);
  console.log(`🔐 JWT Expires: ${process.env.JWT_EXPIRES_IN || 'not set'}`);
  
  // 🗄️ Supabase 연결 테스트
  console.log('\n🗄️ Supabase 연결 확인 중...');
  const isConnected = await testConnection();
  if (isConnected) {
    console.log('✅ Supabase 연결 성공!');
  } else {
    console.log('❌ Supabase 연결 실패 - 환경변수를 확인해주세요');
  }
  console.log('🎉 ====================================\n');
});
// Graceful shutdown 처리 (Ctrl+C로 종료 시 정리 작업)
process.on('SIGINT', () => {
  console.log('\n🛑 서버를 안전하게 종료합니다...');
  process.exit(0);
});

// Express 앱 내보내기 (테스트에서 사용 가능)
module.exports = app;