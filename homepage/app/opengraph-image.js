import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'JnC 음악학원 | 목동 · 양천구 클래식 · 실용음악 전문';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'linear-gradient(135deg, #0d1b3e 0%, #1a3a7a 60%, #0d1b3e 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 배경 장식 원 */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -120,
            width: 500,
            height: 500,
            borderRadius: '50%',
            background: 'rgba(212,168,67,0.08)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: -80,
            width: 360,
            height: 360,
            borderRadius: '50%',
            background: 'rgba(212,168,67,0.06)',
            display: 'flex',
          }}
        />

        {/* 본문 영역 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            flex: 1,
            padding: '64px 80px',
          }}
        >
          {/* 상단 태그 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 28,
            }}
          >
            <div
              style={{
                width: 40,
                height: 3,
                background: '#d4a843',
                borderRadius: 2,
                display: 'flex',
              }}
            />
            <span
              style={{
                color: '#d4a843',
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '0.15em',
              }}
            >
              목동 · 양천구
            </span>
          </div>

          {/* 학원 이름 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginBottom: 32,
            }}
          >
            <span
              style={{
                color: '#ffffff',
                fontSize: 80,
                fontWeight: 900,
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              JnC 음악학원
            </span>
            <span
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: 28,
                fontWeight: 400,
                letterSpacing: '0.02em',
              }}
            >
              JnC Music Academy
            </span>
          </div>

          {/* 설명 */}
          <span
            style={{
              color: 'rgba(255,255,255,0.8)',
              fontSize: 24,
              lineHeight: 1.5,
              maxWidth: 640,
            }}
          >
            클래식 · 실용음악 전 과목 1:1 맞춤 레슨
          </span>

          {/* 태그 뱃지들 */}
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginTop: 36,
              flexWrap: 'wrap',
            }}
          >
            {['피아노', '플루트', '기타', '드럼', '보컬', '첼로', '색소폰'].map((item) => (
              <div
                key={item}
                style={{
                  padding: '8px 18px',
                  borderRadius: 100,
                  border: '1.5px solid rgba(212,168,67,0.45)',
                  color: '#d4a843',
                  fontSize: 16,
                  fontWeight: 600,
                  display: 'flex',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* 하단 정보 바 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 80px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(0,0,0,0.2)',
          }}
        >
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>
            서울 양천구 목동서로 35, 목동프라자 3층
          </span>
          <span style={{ color: '#d4a843', fontSize: 16, fontWeight: 700 }}>
            jncmusic.kr
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
