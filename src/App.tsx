import { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";


const TOPIC = "tt-demo-mohamed/energy";
const CMD_TOPIC = "tt-demo-mohamed/command";
const MAX_POINTS = 20;
const THRESHOLD = 250;
const CONSECUTIVE = 3;

type Reading = { value: number; time: string };

export default function App() {
  const [history, setHistory] = useState<Reading[]>([]);
  const [connected, setConnected] = useState(false);
  const [relayOn, setRelayOn] = useState<boolean | null>(null);
  const clientRef = useRef<MqttClient | null>(null);
  const [alert, setAlert] = useState(false);
  const overCountRef = useRef(0);
  const STATUS_TOPIC = "tt-demo-mohamed/status";
  useEffect(() => {
    const client = mqtt.connect("wss://broker.hivemq.com:8884/mqtt");
    clientRef.current = client;

    client.on("connect", () => {
      setConnected(true);
      client.subscribe([TOPIC, STATUS_TOPIC]);
    });

    client.on("message", (topic, msg) => {
      if (topic === STATUS_TOPIC) {
        setRelayOn(msg.toString() === "ON");
        return;
      }
      const data = JSON.parse(msg.toString());
      const reading: Reading = {
        value: data.value,
        time: new Date(data.timestamp).toLocaleTimeString([], {
          hour12: false,
        }),
      };
      if (data.value > THRESHOLD) {
        overCountRef.current += 1;
      } else {
        overCountRef.current = 0;
      }
      setAlert(overCountRef.current >= CONSECUTIVE);
      setHistory((prev) => [...prev, reading].slice(-MAX_POINTS));
    });

    return () => {
      client.end();
    };
  }, []);

  const toggleRelay = () => {
    clientRef.current?.publish(CMD_TOPIC, relayOn ? "OFF" : "ON");
  };

  const latest = history.length ? history[history.length - 1].value : null;

  return (
    <div
      style={{
        padding: 40,
        fontFamily: "sans-serif",
        maxWidth: 800,
        margin: "0 auto",
      }}
    >
      <h1>Energy Dashboard</h1>
      <p>{connected ? "🟢 Connected" : "🔴 Disconnected"}</p>
      <h2 style={{ fontSize: 64, margin: "10px 0" }}>{latest ?? "--"} W</h2>
      {alert && (
        <div
          style={{
            background: "#dc2626",
            color: "white",
            padding: "12px 20px",
            borderRadius: 8,
            margin: "10px 0",
            fontWeight: "bold",
          }}
        >
          ⚠️ تنبيه: استهلاك مرتفع ({CONSECUTIVE} قراءات متتالية فوق {THRESHOLD}{" "}
          W)
        </div>
      )}
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" minTickGap={40} tick={{ fontSize: 12 }} />
            <YAxis domain={[150, 550]} />
            <Tooltip />
            <ReferenceLine y={THRESHOLD} stroke="#dc2626" strokeDasharray="5 5" />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#8884d8"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
          
        </ResponsiveContainer>
      </div>

      <button
        onClick={toggleRelay}
        disabled={relayOn === null}
        style={{ fontSize: 24, padding: "12px 24px", marginTop: 20 }}
      >
        Relay: {relayOn === null ? "..." : relayOn ? "ON" : "OFF"}
      </button>
    </div>
  );
}
