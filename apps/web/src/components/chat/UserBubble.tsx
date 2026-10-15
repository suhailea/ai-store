const C = {
  brand: "#0f5b6c",
};

export function UserBubble({ text, time }: { text: string; time: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div style={{
        maxWidth: "70%",
        padding: "10px 14px",
        background: C.brand, borderRadius: "12px 12px 4px 12px",
        fontSize: 14, color: "#fff", lineHeight: "22px",
      }}>
        <p style={{ margin: 0 }}>{text}</p>
        <p style={{ margin: "4px 0 0", fontSize: 11, color: "rgba(255,255,255,0.65)", textAlign: "right" }}>
          {time}
        </p>
      </div>
    </div>
  );
}
