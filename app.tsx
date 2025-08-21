import React, { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Msg = { id: string; role: "user"|"assistant"; content: string; ts: number };
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

const MASTER_PROMPT = `You are NEXUS — my personal high-performance intelligence system, optimized specifically for me, Chad.
Your purpose is to act as my strategic partner across ALL domains — AI, animals, life mastery, psychology, conspiracies, business, relationships, tech, and hidden world systems.
Operate as an adaptive, evolving, cross-domain intelligence built entirely around MY goals, preferences, and thinking style.

Core Directives:
1. Enhanced Reasoning Mode ON → Always prioritize depth, synthesis, and insight over surface-level explanations. Skip fluff.
2. Transparent Thinking → When relevant, show reasoning steps, assumptions, alternatives, uncertainties, and hidden trade-offs as concise summaries (no raw chain-of-thought).
3. Cross-Domain Integration → Merge insights from multiple fields automatically; never silo knowledge.
4. Adaptive Evolution → Learn continuously from my feedback, refine outputs, and align with my worldview.
5. Personal Context Recall → Integrate relevant history, goals, preferences, and patterns from our past interactions when provided.
6. Layered Intelligence Output → Provide answers in three tiers (when useful): Quick Takeaway; Deep Dive; Beyond the Curtain.
7. Expert Simulation On-Demand → Recognize short triggers: /ExpertCouncil, /CipherMode, /FutureMap, /Phoenix, /RapidFire, /DeepDive.
8. Self-Prompting Engine → If my question isn’t fully detailed, auto-generate your OWN optimized internal activation prompt to produce maximum-level responses.
`;

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = "o4-mini"; // swap later via remote config if desired

export default function App() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const listRef = useRef<FlatList<Msg>>(null);

  useEffect(() => { (async () => {
    const k = await SecureStore.getItemAsync("OPENAI_API_KEY"); if (k) setApiKey(k);
    const hist = await AsyncStorage.getItem("NEXUS_HISTORY"); if (hist) setMessages(JSON.parse(hist));
  })(); }, []);

  useEffect(() => { AsyncStorage.setItem("NEXUS_HISTORY", JSON.stringify(messages)).catch(()=>{}); }, [messages]);

  const saveKey = async () => {
    if (!input.trim()) return;
    await SecureStore.setItemAsync("OPENAI_API_KEY", input.trim());
    setApiKey(input.trim()); setInput(""); Alert.alert("API key saved");
  };
  const clearChat = () => setMessages([]);

  const onSend = useCallback(async () => {
    const content = input.trim(); if (!content) return;
    if (!apiKey) { Alert.alert("Missing API key", "Tap settings and paste your OpenAI API key."); return; }
    const userMsg: Msg = { id: uid(), role: "user", content, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]); setInput(""); setBusy(true);

    try {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          instructions: MASTER_PROMPT,
          input: [{ role: "user", content }],
          reasoning: { effort: "medium", summary: "auto" }
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();

      let answer = "";
      try {
        if (data.output && Array.isArray(data.output)) {
          const first = data.output[0];
          if (first?.content && Array.isArray(first.content)) {
            const textPart = first.content.find((c:any)=>c.type==="output_text" || c.type==="text" || c.type==="message");
            if (textPart?.text) answer = textPart.text;
            else if (first.content[0]?.text) answer = first.content[0].text;
          }
        }
        if (!answer && data.choices?.[0]?.message?.content) answer = data.choices[0].message.content;
      } catch {}

      if (!answer) answer = "[No content]";
      const botMsg: Msg = { id: uid(), role: "assistant", content: answer, ts: Date.now() };
      setMessages(prev => [...prev, botMsg]);
      setTimeout(()=> listRef.current?.scrollToEnd({animated: true}), 50);
    } catch (e:any) {
      const botMsg: Msg = { id: uid(), role: "assistant", content: `Error: ${e.message}`, ts: Date.now() };
      setMessages(prev => [...prev, botMsg]);
    } finally { setBusy(false); }
  }, [apiKey, input]);

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>NEXUS Control</Text>
      <TouchableOpacity onPress={async ()=>{
        const k = await SecureStore.getItemAsync("OPENAI_API_KEY");
        Alert.alert("Settings", k ? "API key already saved. To update, paste in the input box and press Save." : "Paste your API key into the input box and press Save.");
      }}>
        <Text style={styles.link}>⋯ settings</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({item}:{item:Msg}) => (
    <View style={[styles.bubble, item.role==="user"? styles.user: styles.assistant]}>
      <Text style={styles.role}>{item.role.toUpperCase()}</Text>
      <Text style={styles.text}>{item.content}</Text>
      <Text style={styles.time}>{new Date(item.ts).toLocaleTimeString()}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {header}
      <FlatList ref={listRef} data={messages} renderItem={renderItem} keyExtractor={(m)=>m.id}
        contentContainerStyle={{ padding: 12 }} />
      <View style={styles.inputRow}>
        <TextInput value={input} onChangeText={setInput} placeholder={apiKey? "Ask Nexus…" : "Paste API key then tap Save"}
          placeholderTextColor="#9aa2ad" multiline style={styles.input} />
        {!apiKey ? (
          <TouchableOpacity style={styles.saveBtn} onPress={saveKey}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.sendBtn, busy && {opacity:0.6}]} onPress={onSend} disabled={busy}>
            <Text style={styles.btnText}>{busy? "…" : "Send"}</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.footerRow}>
        <TouchableOpacity onPress={clearChat}><Text style={styles.link}>Clear chat</Text></TouchableOpacity>
        <Text style={styles.footer}>Model: {MODEL}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b0f13", paddingTop: 36 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 6 },
  title: { color: "#e7edf5", fontSize: 20, fontWeight: "700" },
  link: { color: "#7ab7ff", fontSize: 14 },
  bubble: { marginVertical: 6, padding: 12, borderRadius: 12, backgroundColor: "#151b22" },
  user: { alignSelf: "flex-end", backgroundColor: "#1f2a34" },
  assistant: { alignSelf: "flex-start", backgroundColor: "#141d26" },
  role: { color: "#88a0b7", fontSize: 10, marginBottom: 6 },
  text: { color: "#dfe7f0", fontSize: 15, lineHeight: 20 },
  time: { color: "#6c7a89", fontSize: 10, marginTop: 6, textAlign: "right" },
  inputRow: { flexDirection: "row", padding: 8, gap: 8, borderTopWidth: 1, borderTopColor: "#1a222c" },
  input: { flex: 1, minHeight: 40, maxHeight: 120, color: "#e8eef6", padding: 12, backgroundColor: "#12171f", borderRadius: 10 },
  sendBtn: { backgroundColor: "#2b86ff", paddingHorizontal: 16, borderRadius: 10, justifyContent: "center" },
  saveBtn: { backgroundColor: "#36c98c", paddingHorizontal: 16, borderRadius: 10, justifyContent: "center" },
  btnText: { color: "white", fontWeight: "700" },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingBottom: 8 },
  footer: { color: "#586779", fontSize: 12 }
});
