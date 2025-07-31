"use client";
import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3001"); // Replace with your backend URL

export default function ChatPage() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>(
    []
  );
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    interface ChatMessage {
      sender: string;
      text: string;
    }

    socket.on("chat-message", (msg: ChatMessage) => {
      setMessages((prev: ChatMessage[]) => [...prev, msg]);
    });

    return () => {
      socket.off("chat-message");
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      const msg = { sender: "You", text: message };
      socket.emit("chat-message", msg);
      setMessages((prev) => [...prev, msg]);
      setMessage("");
    }
  };

  return (
    <main className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <div className="bg-white w-full max-w-md h-[80vh] rounded-lg shadow-md flex flex-col">
        <div className="p-4 text-xl font-bold border-b">BChat</div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`p-2 rounded-lg max-w-[70%] ${
                msg.sender === "You"
                  ? "bg-green-100 self-end ml-auto"
                  : "bg-blue-100 self-start"
              }`}
            >
              <p className="text-sm text-gray-600">{msg.sender}</p>
              <p>{msg.text}</p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} className="flex p-4 border-t gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2 border rounded-md focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Send
          </button>
        </form>
      </div>
    </main>
  );
}
