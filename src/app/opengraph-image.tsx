import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "KiddoTales - Turn 60 seconds into bedtime magic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fef3f2",
          background: "linear-gradient(135deg, #fef3f2 0%, #cffafe 50%, #d1fae5 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 700,
            color: "#ec4899",
            marginBottom: 16,
          }}
        >
          KiddoTales
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 32,
            color: "#6b7280",
            textAlign: "center",
          }}
        >
          Turn 60 seconds into bedtime magic
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#9ca3af",
            marginTop: 24,
          }}
        >
          Create personalized AI storybooks for your child
        </div>
      </div>
    ),
    { ...size }
  );
}
