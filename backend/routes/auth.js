// ============================================
// 🔐 인증 관련 API 라우트 (Supabase 연동)
// ============================================
const express = require('express');
const router = express.Router();

// 🗄️ Supabase 클라이언트 가져오기
const { supabase, supabaseAdmin } = require('../utils/supabase');

// ============================================
// 📋 인증 라우트 목록
// ============================================

// 🏠 인증 라우트 홈
router.get('/', (req, res) => {
  res.json({
    message: '🔐 Authentication API (Supabase 연동)',
    available_endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      logout: 'POST /api/auth/logout',
      profile: 'GET /api/auth/profile',
      refresh: 'POST /api/auth/refresh'
    },
    note: '실제 Supabase 데이터베이스와 연동됨'
  });
});

// ============================================
// 👤 회원가입 (실제 데이터베이스 연동)
// ============================================
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, diving_experience, location } = req.body;
    
    
    // - 커스텀 입력 검증 (비즈니스 로직)
    // - 필수 필드 체크
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '이메일, 비밀번호, 이름은 필수입니다.',
        required_fields: ['email', 'password', 'name']
      });
    }

    
    // - 커스텀 비밀번호 정책 (Supabase 기본값보다 더 엄격하게)
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '비밀번호는 최소 6자리 이상이어야 합니다.'
      });
    }

    // 🏗️ Supabase Auth가 자동 처리:
    // - 이메일 중복 체크 ✅
    // - 이메일 형식 검증 ✅  
    // - 비밀번호 해싱 (bcrypt) ✅
    // - JWT 토큰 생성 ✅
    // - auth.users 테이블에 기본 정보 저장 ✅
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          name: name,
          diving_experience: diving_experience || 'beginner'
        }
      }
    });

    
    // - Supabase Auth 에러 해석 및 사용자 친화적 메시지 변환
    if (authError) {
      console.error('❌ Auth 에러:', authError);
      
      if (authError.message.includes('already registered')) {
        return res.status(409).json({
          error: 'Conflict',
          message: '이미 가입된 이메일입니다.',
          code: 'EMAIL_ALREADY_EXISTS'
        });
      }
      
      return res.status(400).json({
        error: 'Auth Error',
        message: authError.message
      });
    }

    
    // - 비즈니스 로직에 맞는 추가 사용자 정보를 우리 테이블에 저장
    // - 다이빙 관련 필드들 (diving_experience, total_dives 등)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert([
        {
          id: authData.user.id, // 🔗 Auth ID와 연결
          email: email,
          name: name,
          diving_experience: diving_experience || 'beginner',
          location: location || null,
          total_dives: 0, // 다이빙 앱 전용 필드
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    
    // - users 테이블 저장 실패 시 에러 처리
    if (userError) {
      console.error('❌ User 테이블 에러:', userError);
      
      return res.status(500).json({
        error: 'Database Error',
        message: '사용자 정보 저장 중 오류가 발생했습니다.',
        details: userError.message
      });
    }

    
    // - 성공 응답 구조 설계
    // - 클라이언트에게 필요한 정보만 선별해서 반환
    res.status(201).json({
      message: '회원가입 성공! 🎉',
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        diving_experience: userData.diving_experience,
        location: userData.location,
        created_at: userData.created_at
      },
      auth: {
        access_token: authData.session?.access_token,
        refresh_token: authData.session?.refresh_token,
        expires_at: authData.session?.expires_at
      },
      note: '이메일 인증이 필요할 수 있습니다.'
    });

  } catch (error) {
    
    // - 예상치 못한 에러 핸들링
    console.error('❌ 회원가입 에러:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '회원가입 처리 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 🔑 로그인 (실제 인증)
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    
    // - 입력 검증
    if (!email || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '이메일과 비밀번호를 입력해주세요.',
        required_fields: ['email', 'password']
      });
    }

    // 🏗️ Supabase Auth가 자동 처리:
    // - 이메일/비밀번호 검증 ✅
    // - 비밀번호 해시 비교 ✅
    // - JWT 토큰 발급 ✅
    // - 세션 생성 ✅
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    
    // - 로그인 실패 시 사용자 친화적 에러 메시지
    if (authError) {
      console.error('❌ 로그인 에러:', authError);
      
      return res.status(401).json({
        error: 'Unauthorized',
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    
    // - 추가 사용자 정보를 우리 테이블에서 조회
    // - 다이빙 관련 정보 (total_dives, deepest_dive 등)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    
    // - users 테이블 조회 실패 시 기본값 처리
    if (userError) {
      console.error('❌ 사용자 정보 조회 에러:', userError);
    }

    
    // - 로그인 성공 응답 구조 설계
    res.json({
      message: '로그인 성공! 🎉',
      user: userData || {
        id: authData.user.id,
        email: authData.user.email,
        name: authData.user.user_metadata?.name || '이름 없음'
      },
      auth: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
        expires_at: authData.session.expires_at,
        expires_in: authData.session.expires_in
      }
    });

  } catch (error) {
    
    // - 예상치 못한 에러 핸들링
    console.error('❌ 로그인 에러:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '로그인 처리 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 🚪 로그아웃 (실제 세션 종료)
// ============================================
router.post('/logout', async (req, res) => {
  try {
    
    // - Authorization 헤더에서 토큰 추출
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (token) {
      // 🏗️ Supabase Auth가 자동 처리:
      // - 서버 측 세션 무효화 ✅
      // - JWT 토큰 블랙리스트 등록 ✅
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ 로그아웃 에러:', error);
      }
    }

    
    // - 성공 응답 (클라이언트 측 토큰 삭제 안내)
    res.json({
      message: '로그아웃 성공! 👋',
      note: '클라이언트에서 토큰을 삭제해주세요.'
    });

  } catch (error) {
    
    // - 에러 핸들링
    console.error('❌ 로그아웃 에러:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '로그아웃 처리 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 👤 현재 사용자 프로필 조회
// ============================================
router.get('/profile', async (req, res) => {
  try {
    
    // - Authorization 헤더 파싱
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: '인증 토큰이 필요합니다.',
        note: 'Authorization 헤더에 Bearer 토큰을 포함해주세요.'
      });
    }

    // 🏗️ Supabase Auth가 자동 처리:
    // - JWT 토큰 검증 ✅
    // - 토큰 만료 시간 확인 ✅
    // - 사용자 ID 추출 ✅
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    
    // - 인증 실패 시 에러 처리
    if (authError || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: '유효하지 않은 토큰입니다.'
      });
    }

    
    // - 우리 테이블에서 상세 사용자 정보 조회
    // - 다이빙 통계, 프로필 정보 등
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    
    // - 데이터 조회 실패 시 에러 처리
    if (userError) {
      console.error('❌ 사용자 정보 조회 에러:', userError);
      return res.status(404).json({
        error: 'Not Found',
        message: '사용자 정보를 찾을 수 없습니다.'
      });
    }

    
    // - 응답 데이터 구조화
    res.json({
      message: '프로필 조회 성공',
      user: userData
    });

  } catch (error) {
    
    // - 예상치 못한 에러 핸들링
    console.error('❌ 프로필 조회 에러:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '프로필 조회 중 오류가 발생했습니다.'
    });
  }
});

// 라우터 내보내기
module.exports = router;