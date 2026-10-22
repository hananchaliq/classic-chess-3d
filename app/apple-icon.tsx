import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 30%, #2C241D 0%, #171411 68%, #0D0B09 100%)',
          borderRadius: 40,
          border: '5px solid #C7A66A',
          color: '#E6C98F',
          fontSize: 112,
          fontWeight: 700,
        }}
      >
        ♚
      </div>
    ),
    {
      ...size,
    }
  );
}
