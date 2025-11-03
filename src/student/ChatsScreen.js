import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { db } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import Ionicons from "react-native-vector-icons/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import HapticFeedback from "react-native-haptic-feedback";

const { width } = Dimensions.get("window");

const ChatScreen = ({ route, navigation }) => {
  const { studentId, supervisorId } = route.params;
  const normalizedStudentId = (studentId || "").trim().toLowerCase();
  const normalizedSupervisorId = (supervisorId || "").trim().toLowerCase();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  const chatId = `${normalizedStudentId}_${normalizedSupervisorId}`;
  const flatListRef = useRef(null);
  const textInputRef = useRef(null);
  const emojiHeight = 250;

  const colors = {
    primary: "#6C63FF",
    secondary: "#FF6584",
    inputBg: "#FFFFFF",
    muted: "#A0AEC0",
  };

  const EMOJIS = [
    "😀","😁","😂","😊","😍","😅","🤣","🙂","😉","😎","😢","😭",
    "😡","😇","🤓","🤗","🤔","😴","🤩","😜","😝","👍","👎",
    "👏","🙏","🎉","🔥","❤️","💯"
  ];

  // 🔹 Load messages (no auto-scroll here)
  useEffect(() => {
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [chatId]);

  // 🔹 Send message (scrolls down after sending only)
  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMsg = {
      text: input.trim(),
      senderId: normalizedStudentId,
      createdAt: serverTimestamp(),
      read: false,
    };
    setInput("");
    await addDoc(collection(db, "chats", chatId, "messages"), newMsg);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 150);
    HapticFeedback.trigger("impactLight");
  };

  // 🔹 Toggle emoji picker
  const toggleEmojiPicker = () => {
    if (showEmojiPicker) {
      setShowEmojiPicker(false);
      setTimeout(() => textInputRef.current?.focus(), 50);
    } else {
      Keyboard.dismiss();
      setTimeout(() => setShowEmojiPicker(true), 50);
    }
  };

  const handleEmojiSelected = (emoji) => setInput((prev) => prev + emoji);

  const renderItem = useCallback(
    ({ item }) => {
      const isCurrentUser =
        (item.senderId || "").toLowerCase() === normalizedStudentId;
      return (
        <View
          style={[
            styles.messageContainer,
            isCurrentUser && styles.messageContainerCurrentUser,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isCurrentUser ? styles.sender : styles.receiver,
            ]}
          >
            <Text
              style={[styles.messageText, isCurrentUser && styles.senderText]}
            >
              {item.text}
            </Text>
          </View>
        </View>
      );
    },
    [normalizedStudentId]
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 25}
    >
      {/* Header */}
      <LinearGradient
        colors={["#1E3C72", "#2A5298"]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Supervisor Chat</Text>
          <Text style={styles.headerSubtitle}>Chat with your supervisor</Text>
        </View>
      </LinearGradient>

      {/* Messages */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.flatListContent}
          style={styles.flatList}
          ListFooterComponent={
            <View style={{ height: showEmojiPicker ? emojiHeight : 0 }} />
          }
        />
      )}

      {/* Input Box */}
      <View style={styles.inputContainer}>
        <TouchableOpacity onPress={toggleEmojiPicker} style={styles.emojiButton}>
          <Ionicons
            name={showEmojiPicker ? "close" : "happy-outline"}
            size={28}
            color={colors.primary}
          />
        </TouchableOpacity>

        <TextInput
          ref={textInputRef}
          value={input}
          onChangeText={setInput}
          placeholder="Type a message..."
          placeholderTextColor={colors.muted}
          style={styles.textInput}
          multiline
          onFocus={() => setShowEmojiPicker(false)}
        />

        <TouchableOpacity
          onPress={sendMessage}
          style={[styles.sendButton, !input.trim() && styles.disabledButton]}
          disabled={!input.trim()}
        >
          <LinearGradient
            colors={
              !input.trim()
                ? ["#ccc", "#aaa"]
                : [colors.primary, colors.secondary]
            }
            style={styles.sendButtonGradient}
          >
            <Ionicons name="send" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <View style={styles.emojiContainer}>
          <FlatList
            data={EMOJIS}
            numColumns={8}
            keyExtractor={(item, i) => String(i)}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleEmojiSelected(item)}
                style={styles.emojiCell}
              >
                <Text style={styles.emojiText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F2F5FF" },
  header: {
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: "#1E3C72",
    elevation: 8,
  },
  backButton: { marginRight: 10 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  loaderContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loaderText: { marginTop: 10, color: "#555" },

  flatList: { flex: 1 },
  flatListContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },

  messageContainer: {
    marginVertical: 6,
    maxWidth: "80%",
    alignSelf: "flex-start",
  },
  messageContainerCurrentUser: { alignSelf: "flex-end" },
  messageBubble: {
    padding: 14,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  sender: { backgroundColor: "#0078FF" },
  receiver: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" },
  messageText: { fontSize: 16, color: "#2D3748" },
  senderText: { color: "#FFF" },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    backgroundColor: "#F7FAFC",
    borderRadius: 24,
    fontSize: 16,
    color: "#2D3748",
  },
  emojiButton: { padding: 6, marginRight: 6 },

  emojiContainer: {
    height: 250,
    width: "100%",
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderColor: "#E2E8F0",
  },
  emojiCell: {
    width: "12.5%",
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  emojiText: { fontSize: 22 },
  sendButton: { marginLeft: 8, borderRadius: 24, overflow: "hidden" },
  sendButtonGradient: {
    padding: 10,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: { opacity: 0.5 },
});

export default ChatScreen;
