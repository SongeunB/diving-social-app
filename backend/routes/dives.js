// ============================================
// 🌊 다이빙 관련 API 라우트
// ============================================
const express = require('express');
const router = express.Router();

// ============================================
// 📋 다이빙 라우트 목록
// ============================================

// 🏠 다이빙 라우트 홈
router.get('/', (req, res) => {
  res.json({
    message: '🌊 Dives API',
    available_endpoints: {
      list: 'GET /api/dives (다이빙 로그 목록)',
      create: 'POST /api/dives (새 다이빙 기록)',
      detail: 'GET /api/dives/:id (특정 다이빙 조회)',
      update: 'PUT /api/dives/:id (다이빙 기록 수정)',
      delete: 'DELETE /api/dives/:id (다이빙 기록 삭제)',
      stats: 'GET /api/dives/stats (다이빙 통계)',
      spots: 'GET /api/dives/spots (다이빙 포인트)',
      photos: 'GET/POST /api/dives/:id/photos (사진 관리)'
    }
  });
});

// ============================================
// 🆕 새로운 다이빙 기록 생성
// ============================================
router.post('/create', async (req, res) => {
  try {
    const {
      dive_type,
      location_name,
      country,
      coordinates,
      dive_date,
      duration_minutes,
      max_depth,
      average_depth,
      water_temperature,
      visibility_meters,
      weather,
      current_strength,
      equipment,
      air_consumption,
      safety_buddy_name,
      marine_life,
      notes,
      rating
    } = req.body;

    // 토큰에서 사용자 ID 추출
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: '인증 토큰이 필요합니다.'
      });
    }

    // 🏗️ Supabase가 자동 처리:
    // - JWT 토큰 검증 및 사용자 ID 추출 ✅
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: '유효하지 않은 토큰입니다.'
      });
    }

    // 필수 필드 검증
    const requiredFields = ['dive_type', 'location_name', 'dive_date', 'max_depth'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '필수 필드가 누락되었습니다.',
        missing_fields: missingFields,
        required_fields: requiredFields
      });
    }

    // 다이빙 타입 검증
    if (!['freediving', 'scuba'].includes(dive_type)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '다이빙 타입은 freediving 또는 scuba여야 합니다.',
        allowed_types: ['freediving', 'scuba']
      });
    }

    // 사용자의 현재 다이빙 횟수 조회 (dive_number 계산용)
    const { count: currentDiveCount } = await supabase
      .from('dives')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const nextDiveNumber = (currentDiveCount || 0) + 1;

    // 좌표 처리 (PostgreSQL POINT 형식)
    let coordinatesPoint = null;
    if (coordinates && coordinates.lat && coordinates.lng) {
      coordinatesPoint = `POINT(${coordinates.lng} ${coordinates.lat})`;
    }

    // 🏗️ Supabase가 자동 처리:
    // - UUID 자동 생성 ✅
    // - 타임스탬프 자동 설정 ✅
    // - 데이터 타입 검증 ✅
    // - 트랜잭션 처리 ✅
    const { data: newDive, error: diveError } = await supabase
      .from('dives')
      .insert([
        {
          user_id: user.id,
          dive_type,
          dive_number: nextDiveNumber,
          location_name,
          country: country || null,
          coordinates: coordinatesPoint,
          dive_date,
          duration_minutes: duration_minutes || null,
          max_depth,
          average_depth: average_depth || null,
          water_temperature: water_temperature || null,
          visibility_meters: visibility_meters || null,
          weather: weather || null,
          current_strength: current_strength || null,
          equipment: equipment || {},
          air_consumption: dive_type === 'scuba' ? air_consumption : null,
          safety_buddy_name: safety_buddy_name || null,
          marine_life: marine_life || [],
          notes: notes || '',
          rating: rating || null,
          photos_count: 0,
          videos_count: 0
        }
      ])
      .select()
      .single();

    if (diveError) {
      console.error('❌ 다이빙 기록 생성 에러:', diveError);
      return res.status(500).json({
        error: 'Database Error',
        message: '다이빙 기록 생성 중 오류가 발생했습니다.',
        details: diveError.message
      });
    }

    // 사용자의 total_dives와 deepest_dive 업데이트
    const updateData = {
      total_dives: nextDiveNumber,
      updated_at: new Date().toISOString()
    };

    // 최대 깊이 기록 갱신 확인
    const { data: currentUser } = await supabase
      .from('users')
      .select('deepest_dive')
      .eq('id', user.id)
      .single();

    if (!currentUser?.deepest_dive || max_depth > currentUser.deepest_dive) {
      updateData.deepest_dive = max_depth;
    }

    // 🏗️ Supabase가 자동 처리:
    // - 사용자 통계 업데이트 ✅
    await supabase
      .from('users')
      .update(updateData)
      .eq('id', user.id);

    res.status(201).json({
      message: '다이빙 기록 생성 성공! 🎉',
      dive: newDive,
      stats: {
        dive_number: nextDiveNumber,
        is_new_depth_record: updateData.deepest_dive === max_depth
      }
    });

  } catch (error) {
    console.error('❌ 다이빙 기록 생성 에러:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '다이빙 기록 생성 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 📋 다이빙 로그 목록 조회 (실제 DB)
// ============================================
router.get('/list', async (req, res) => {
  try {
    // 쿼리 파라미터 처리
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const user_id = req.query.user_id;
    const dive_type = req.query.type;
    const location = req.query.location;

    // 페이지네이션 계산
    const startIndex = (page - 1) * limit;

    // 🏗️ Supabase가 자동 처리:
    // - 복잡한 조인 쿼리 ✅
    // - 필터링 및 정렬 ✅
    // - 페이지네이션 ✅
    let query = supabase
      .from('dives')
      .select(`
        *,
        users!inner(name, diving_experience)
      `, { count: 'exact' })
      .range(startIndex, startIndex + limit - 1)
      .order('dive_date', { ascending: false });

    // 필터 적용
    if (user_id) {
      query = query.eq('user_id', user_id);
    }
    if (dive_type) {
      query = query.eq('dive_type', dive_type);
    }
    if (location) {
      query = query.ilike('location_name', `%${location}%`);
    }

    const { data: dives, error, count } = await query;

    if (error) {
      console.error('❌ 다이빙 목록 조회 에러:', error);
      return res.status(500).json({
        error: 'Database Error',
        message: '다이빙 목록 조회 중 오류가 발생했습니다.'
      });
    }

    // 응답 데이터 구조화
    const formattedDives = dives.map(dive => ({
      ...dive,
      user_name: dive.users?.name || '알 수 없음',
      user_experience: dive.users?.diving_experience || 'unknown'
    }));

    res.json({
      message: '다이빙 로그 목록 조회 성공',
      data: formattedDives,
      pagination: {
        current_page: page,
        per_page: limit,
        total_dives: count,
        total_pages: Math.ceil(count / limit),
        has_next: startIndex + limit < count,
        has_prev: page > 1
      },
      filters: {
        user_id: user_id || null,
        dive_type: dive_type || null,
        location: location || null
      }
    });

  } catch (error) {
    console.error('❌ 다이빙 목록 조회 에러:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '다이빙 목록 조회 중 오류가 발생했습니다.'
    });
  }
});

// ============================================
// 🔍 특정 다이빙 기록 조회 (실제 DB)
// ============================================
router.get('/:id', async (req, res) => {
  try {
    const diveId = req.params.id;

    // UUID 형식 검증
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(diveId)) {
      return res.status(400).json({
        error: 'Bad Request',
        message: '유효하지 않은 다이빙 ID 형식입니다.'
      });
    }

    // 🏗️ Supabase가 자동 처리:
    // - 조인 쿼리로 사용자 정보도 함께 조회 ✅
    const { data: dive, error } = await supabase
      .from('dives')
      .select(`
        *,
        users!inner(name, diving_experience, location)
      `)
      .eq('id', diveId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return res.status(404).json({
          error: 'Not Found',
          message: '다이빙 기록을 찾을 수 없습니다.'
        });
      }

      console.error('❌ 다이빙 상세 조회 에러:', error);
      return res.status(500).json({
        error: 'Database Error',
        message: '다이빙 상세 조회 중 오류가 발생했습니다.'
      });
    }

    // 응답 데이터 구조화
    const formattedDive = {
      ...dive,
      user_name: dive.users?.name || '알 수 없음',
      user_experience: dive.users?.diving_experience || 'unknown',
      user_location: dive.users?.location || null
    };

    // users 객체 제거 (중복 데이터)
    delete formattedDive.users;

    res.json({
      message: '다이빙 상세 정보 조회 성공',
      dive: formattedDive
    });

  } catch (error) {
    console.error('❌ 다이빙 상세 조회 에러:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '다이빙 상세 조회 중 오류가 발생했습니다.'
    });
  }
});

// 라우터 내보내기
module.exports = router;