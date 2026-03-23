import { useState, useRef, useEffect } from "react";

export default function Chat({ messages, onSend, myName }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput("");
  };

  return (
    <div className="chat-panel">
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`chat-msg ${m.type === "system" ? "system" : m.name === myName ? "mine" : "theirs"}`}
          >
            {m.type !== "system" && m.name !== myName && (
              <span className="chat-author">{m.name}</span>
            )}
            <span className="chat-bubble">{m.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="chat-input-row">
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ketik pesan..."
          maxLength={300}
        />
        <button className="chat-send-btn" onClick={handleSend}>
          ➤
        </button>
      </div>
    </div>
  );
}
