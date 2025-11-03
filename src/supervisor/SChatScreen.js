import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Animated,
  Dimensions,
  StatusBar,
  ScrollView,
  Platform,
  TouchableWithoutFeedback,
  PanResponder,
} from "react-native";
import { db } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import Ionicons from "react-native-vector-icons/Ionicons";
import LinearGradient from "react-native-linear-gradient";
import MemoizedMessageItem from "./MemoizedMessageItem";

const { width } = Dimensions.get("window");
const EMOJIS = [
  "😀", "😁", "😂", "😊", "😍", "😅", "🤣", "🙂", "🙃", "😉", "😎",
  "😢", "😭", "😡", "😇", "🤓", "🤗", "🤔", "😴", "😬", "🤩", "😜",
  "😝", "👍", "👎", "👏", "🙏", "🎉", "🔥", "❤️", "💯",
];
const ITEM_HEIGHT_FALLBACK = 80;

const SupervisorChatScreen = ({ route, navigation }) => {
  const { studentId, supervisorId } = route.params;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [pressedMessage, setPressedMessage] = useState(null);

  const flatListRef = useRef(null);
  const textInputRef = useRef(null);
  const chatId = `${studentId}_${supervisorId}`;
  const measuredHeights = useRef({});
  const emojiPanelAnim = useRef(new Animated.Value(0)).current;

  // 🔹 Real-time listener
  useEffect(() => {
    const msgRef = collection(db, "chats", chatId, "messages");
    const q = query(msgRef, orderBy("createdAt"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const current = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(current);

      // mark unread messages as read
      const batch = writeBatch(db);
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const msg = change.doc.data();
          if (msg.senderId === studentId && msg.read === false) {
            const ref = doc(db, "chats", chatId, "messages", change.doc.id);
            batch.update(ref, { read: true });
          }
        }
      });
      await batch.commit().catch((e) => console.error("Batch commit error:", e));
    });
    return () => unsubscribe();
  }, [chatId, studentId]);

  // 🔹 Send Message
  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const msgData = {
      text: trimmed,
      senderId: supervisorId,
      createdAt: serverTimestamp(),
      read: false,
    };

    if (replyingTo) {
      msgData.replyTo = {
        messageId: replyingTo.id,
        text: replyingTo.text,
        senderId: replyingTo.senderId,
      };
    }

    setInput("");
    setReplyingTo(null);
    hideEmojiPanel();

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), msgData);
    } catch (err) {
      console.error("Send error:", err);
      setInput(trimmed);
    }
  };

  // 🔹 Emoji controls
  const toggleEmojiPicker = () => {
    if (showEmojiPicker) {
      hideEmojiPanel();
      textInputRef.current?.focus();
    } else {
      Keyboard.dismiss();
      showEmojiPanel();
    }
  };

  const showEmojiPanel = () => {
    setShowEmojiPicker(true);
    Animated.timing(emojiPanelAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const hideEmojiPanel = () => {
    Animated.timing(emojiPanelAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setShowEmojiPicker(false));
  };

  const handleEmojiSelected = (emoji) => setInput((prev) => prev + emoji);

  const handleReply = useCallback((message) => {
    setReplyingTo(message);
    hideEmojiPanel();
    setTimeout(() => textInputRef.current?.focus(), 100);
  }, []);

  const cancelReply = () => {
    setReplyingTo(null);
    Keyboard.dismiss();
  };

  const onItemLayout = useCallback((event, id) => {
    const { height } = event.nativeEvent.layout;
    measuredHeights.current[id] = height;
  }, []);

  const renderItem = useCallback(
    ({ item }) => (
      <View onLayout={(event) => onItemLayout(event, item.id)}>
        <MemoizedMessageItem
          item={item}
          supervisorId={supervisorId}
          studentId={studentId}
          handleReply={handleReply}
          pressedMessage={pressedMessage}
          styles={styles}
        />
      </View>
    ),
    [supervisorId, studentId, handleReply, pressedMessage, onItemLayout]
  );

  // 🟢 Tap/swipe close behavior
  const handleCloseEmoji = () => {
    hideEmojiPanel();
    setTimeout(() => textInputRef.current?.focus(), 150);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 10,
      onPanResponderMove: (_, g) => {
        if (g.dy > 30) handleCloseEmoji();
      },
    })
  ).current;

  const emojiPanelTranslateY = emojiPanelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <TouchableWithoutFeedback onPress={handleCloseEmoji}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#28a745" />

        {/* Header */}
        <LinearGradient
          colors={["#28a745", "#1e7e34"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.header}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Student Chat</Text>
            <Text style={styles.headerSubtitle}>Active now</Text>
          </View>
          <TouchableOpacity style={styles.menuButton}>
            <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
          </TouchableOpacity>
        </LinearGradient>

        {/* Chat Area */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onScrollBeginDrag={Keyboard.dismiss}
          />

          {/* Reply Indicator */}
          {replyingTo && (
            <View style={styles.replyIndicator}>
              <View style={styles.replyIndicatorContent}>
                <Text style={styles.replyIndicatorLabel}>
                  Replying to{" "}
                  {replyingTo.senderId === supervisorId ? "yourself" : "student"}
                </Text>
                <Text style={styles.replyIndicatorText} numberOfLines={1}>
                  {replyingTo.text}
                </Text>
              </View>
              <TouchableOpacity
                onPress={cancelReply}
                style={styles.cancelReplyButton}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input Box */}
          <View style={styles.inputWrapper}>
            <View style={styles.inputContainer}>
              <TouchableOpacity
                onPress={toggleEmojiPicker}
                style={styles.iconButton}
              >
                <Ionicons
                  name={showEmojiPicker ? "chatbubble" : "happy-outline"}
                  size={26}
                  color="#28a745"
                />
              </TouchableOpacity>

              <TextInput
                ref={textInputRef}
                style={styles.textInput}
                value={input}
                onChangeText={setInput}
                placeholder="Type a message..."
                placeholderTextColor="#999"
                multiline
                maxLength={500}
                onFocus={() => setShowEmojiPicker(false)}
              />

              <TouchableOpacity
                onPress={sendMessage}
                style={[
                  styles.sendButton,
                  !input.trim() && styles.disabledButton,
                ]}
                disabled={!input.trim()}
              >
                <Ionicons name="send" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.emojiContainer,
              { transform: [{ translateY: emojiPanelTranslateY }] },
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.emojiGrid}
              showsVerticalScrollIndicator={false}
            >
              {EMOJIS.map((emoji, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.emojiItem}
                  onPress={() => handleEmojiSelected(emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
};

// 🧩 Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f4f6f8" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 6,
    shadowColor: "#000",
  },
  backButton: { padding: 4, marginRight: 10 },
  headerTextContainer: { flex: 1, marginLeft: 10 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#fff" },
  headerSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  menuButton: { padding: 4 },
  listContent: { padding: 16, paddingBottom: 120 },
  inputWrapper: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#e0e0e0",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f6f6f6",
    borderRadius: 25,
    paddingHorizontal: 12,
  },
  iconButton: { padding: 6 },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#333",
  },
  sendButton: {
    backgroundColor: "#28a745",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledButton: { backgroundColor: "#bbb" },
  replyIndicator: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#28a745",
  },
  replyIndicatorContent: { flex: 1, marginRight: 10 },
  replyIndicatorLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginBottom: 2,
  },
  replyIndicatorText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  cancelReplyButton: { padding: 4 },
  emojiContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 250,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#e0e0e0",
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    padding: 10,
  },
  emojiItem: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    margin: 5,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  emojiText: { fontSize: 24 },
});

export default SupervisorChatScreen;
