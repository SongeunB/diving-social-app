// ============================================
// 👤 사용자 관련 API 라우트 (Supabase 연동)
// ============================================
const express = require('express');
const router = express.Router();

// Supabase 클라이언트 가져오기
const { supabase, supabaseAdmin } = require('../utils/supabase');

// ============================================
// 📋 사용자 라우트 목록
// ============================================

// 🏠 사용자 라우트 홈
router.get('/', (req, res) => {
  res.json({
    message: '👤 Users API',
    available_endpoints: {
      list: 'GET /api/users (모든 사용자 조회)',
      profile: 'GET /api/users/:id (특정 사용자 프로필)',
      update: 'PUT /api/users/:id (프로필 수정)',
      settings: 'GET/PUT /api/users/:id/settings (설정 관리)',
      search: 'GET /api/users/search?q=keyword (사용자 검색)',
      buddies: 'GET /api/users/:id/buddies (버디 목록)'
    }
  });
});

// ============================================
// 📋 모든 사용자 조회 (페이지네이션 포함)
// ============================================
router.get('/list', async (req, res) => {
  try {
    // 쿼리 파라미터 처리
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const sort = req.query.sort || 'created_at'; // name, created_at, total_dives

    // 페이지네이션 계산
    const startIndex = (page - 1) * limit;

    // 🏗️ Supabase가 자동 처리:
    // - SQL 쿼리 생성 및 실행 ✅
    // - 페이지네이션 처리 ✅
    // - 정렬 처리 ✅
    let query = supabase
      .from('users')
      .select('id, name, email, diving_experience, total_dives, deepest_dive, location, created_at', { count: 'exact' })
      .range(startIndex, startIndex + limit - 1);

    // 정렬 적용
    if (sort === 'total_dives') {
      query = query.order('total_dives', { ascending: false });
    } else if (sort === 'name') {
      query = query.order('name', { ascending: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: users, error, count } = await query;

    if (error) {
      console.error('❌ 사용자 목록 조회 에러:', error);
      return res.status(500).json({
        error: 'Database Error',
        message: '사용자 목록 조회 중 오류가 발생했습니다.'
      });
    }

    // 응답 데이터 구조화
    res.json({
      message: '사용자 목록 조회 성공',
      data: users,
      pagination: {
        current_page: page,
        per_page: limit,
        total_users: count,
        total_pages: Math.ceil(count / limit),
        has_next: startIndex + limit < count,
        has_prev: page > 1
      },
      sort: sort
    });

  } catch (error) {
    console.error('❌ 사용자 목록 조회 에러:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '사용자 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 👤 특정 사용자 프로필 조회
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '유효하지 않은 사용자 ID 형식입니다.',
        example: '/api/users/123e4567-e89b-12d3-a456-426614174000'
      });
    }

    // 🏗️ Supabase가 자동 처리:
    // - UUID 기반 사용자 조회 ✅
    // - 존재하지 않는 사용자 처리 ✅
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return res.status(404).json({
          error: 'Not Found',
          message: '사용자를 찾을 수 없습니다.'
        });
      }

      console.error('❌ 사용자 조회 에러:', error);
      return res.status(500).json({
        error: 'Database Error',
        message: '사용자 조회 중 오류가 발생했습니다.'
      });
    }

    // 사용자의 다이빙 통계 조회
    const { data: diveStats, error: statsError } = await supabase
      .from('dives')
      .select('dive_type, max_depth, dive_date')
      .eq('user_id', userId);

    // 통계 계산 (다이빙 기록이 없어도 에러는 아님)
    const stats = {
      total_photos: 0, // 추후 구현
      buddies_count: 0, // 추후 구현
      recent_dives: diveStats?.length || 0,
      dive_types: diveStats?.reduce((acc, dive) => {
        acc[dive.dive_type] = (acc[dive.dive_type] || 0) + 1;
        return acc;
      }, {}) || {}
    };

    res.json({
      message: '사용자 프로필 조회 성공',
      user: {
        ...user,
        stats
      }
    });

  } catch (error) {
    console.error('❌ 사용자 프로필 조회 에러:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '사용자 프로필 조회 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// ✏️ 사용자 프로필 수정
// ============================================
router.put('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = req.body;

    // UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '유효하지 않은 사용자 ID 형식입니다.'
      });
    }

    // 수정 가능한 필드만 허용
    const allowedFields = [
      'name', 'bio', 'location', 'diving_experience', 
      'certifications', 'social_links', 'preferences'
    ];

    const filteredData = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    });

    // 수정할 데이터가 없는 경우
    if (Object.keys(filteredData).length === 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '수정할 데이터가 없습니다.',
        allowed_fields: allowedFields
      });
    }

    // updated_at 추가
    filteredData.updated_at = new Date().toISOString();

    // 🏗️ Supabase가 자동 처리:
    // - 사용자 존재 여부 확인 ✅
    // - UPDATE 쿼리 실행 ✅
    // - 수정된 데이터 반환 ✅
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(filteredData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return res.status(404).json({
          error: 'Not Found',
          message: '사용자를 찾을 수 없습니다.'
        });
      }

      console.error('❌ 프로필 수정 에러:', error);
      return res.status(500).json({
        error: 'Database Error',
        message: '프로필 수정 중 오류가 발생했습니다.'
      });
    }

    res.json({
      message: '프로필 수정 성공! ✨',
      user: updatedUser,
      updated_fields: Object.keys(filteredData)
    });

  } catch (error) {
    console.error('❌ 프로필 수정 에러:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '프로필 수정 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 🔍 사용자 검색
// ============================================
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    const location = req.query.location;
    const experience = req.query.experience;

    // 검색어 검증
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '검색어는 최소 2글자 이상이어야 합니다.',
        example: '/api/users/search?q=김다이버&location=제주도'
      });
    }

    // 🏗️ Supabase가 자동 처리:
    // - LIKE 검색 쿼리 ✅
    // - 다중 조건 필터링 ✅
    // - 정확한 매칭 및 부분 매칭 ✅
    let searchQuery = supabase
      .from('users')
      .select('id, name, location, diving_experience, total_dives, deepest_dive, created_at')
      .ilike('name', `%${query}%`); // 대소문자 무시 LIKE 검색

    // 추가 필터 적용
    if (location) {
      searchQuery = searchQuery.ilike('location', `%${location}%`);
    }

    if (experience) {
      searchQuery = searchQuery.eq('diving_experience', experience);
    }

    // 최대 20개 결과로 제한
    searchQuery = searchQuery.limit(20);

    const { data: searchResults, error } = await searchQuery;

    if (error) {
      console.error('❌ 사용자 검색 에러:', error);
      return res.status(500).json({
        error: 'Database Error',
        message: '사용자 검색 중 오류가 발생했습니다.'
      });
    }

    res.json({
      message: '사용자 검색 성공',
      query: {
        search_term: query,
        location_filter: location || null,
        experience_filter: experience || null
      },
      results: searchResults,
      total_found: searchResults.length
    });

  } catch (error) {
    console.error('❌ 사용자 검색 에러:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '사용자 검색 중 오류가 발생했습니다.'
    });
  }
});

// 라우터 내보내기
module.exports = router;