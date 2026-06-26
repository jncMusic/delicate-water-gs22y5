import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#0d1b3e',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            color: '#d4a843',
            fontSize: 18,
            fontWeight: 900,
            letterSpacing: '-0.05em',
          }}
        >
          J
        </span>
      </div>
    ),
    { ...size }
  );
}
