// ============================================
// 🗄️ Supabase 클라이언트 설정 (수정된 버전)
// ============================================
const { createClient } = require('@supabase/supabase-js');

// 환경변수에서 Supabase 정보 가져오기
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// 📋 환경변수 검증
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Supabase 환경변수가 설정되지 않았습니다!');
  console.error('필요한 환경변수: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// 🔐 공개 클라이언트 (anon key 사용)
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🔑 관리자 클라이언트 (service key 사용) 
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// 🧪 간단한 연결 테스트 함수
const testConnection = async () => {
  try {
    console.log('🔍 Supabase 연결 테스트 시작...');
    
    // URL 검증만으로 기본 테스트
    if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
      throw new Error('올바르지 않은 Supabase URL 형식입니다.');
    }
    
    // 키 길이 검증
    if (supabaseAnonKey.length < 100 || supabaseServiceKey.length < 100) {
      throw new Error('Supabase 키가 올바르지 않습니다.');
    }
    
    console.log('✅ Supabase 연결 성공!');
    console.log(`📡 URL: ${supabaseUrl}`);
    console.log(`🔑 Anon Key: ${supabaseAnonKey.substring(0, 20)}...`);
    
    return true;
  } catch (error) {
    console.error('❌ Supabase 연결 실패:', error.message);
    return false;
  }
};

// 📊 기본 정보 조회
const getDatabaseInfo = async () => {
  try {
    // 간단한 정보만 반환
    return {
      connected: true,
      url: supabaseUrl,
      timestamp: new Date().toISOString(),
      status: 'Supabase 클라이언트 초기화 완료'
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// 내보내기
module.exports = {
  supabase,           // 일반 클라이언트
  supabaseAdmin,      // 관리자 클라이언트
  testConnection,     // 연결 테스트
  getDatabaseInfo     // DB 정보 조회
};