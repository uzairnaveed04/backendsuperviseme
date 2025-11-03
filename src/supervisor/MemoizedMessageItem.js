import React, { memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

const MemoizedMessageItem = memo(
  ({ item, supervisorId, handleReply, pressedMessage }) => {
    const isCurrentUser = item.senderId === supervisorId;

    return (
      <View
        style={[
          styles.messageContainer,
          isCurrentUser && styles.messageContainerCurrentUser,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => handleReply(item)}
          delayLongPress={300}
          style={[
            styles.messageBubble,
            isCurrentUser ? styles.sender : styles.receiver,
            pressedMessage === item.id && styles.pressedMessage,
          ]}
        >
          {/* Reply Preview */}
          {item.replyTo && (
            <View
              style={[
                styles.replyPreview,
                isCurrentUser
                  ? styles.replyPreviewSender
                  : styles.replyPreviewReceiver,
              ]}
            >
              <Text style={styles.replyPreviewText} numberOfLines={1}>
                {item.replyTo.senderId === supervisorId ? "You" : "Student"}:{" "}
                {item.replyTo.text}
              </Text>
            </View>
          )}

          {/* Message Text */}
          <Text
            style={[
              styles.messageText,
              isCurrentUser ? styles.senderText : styles.receiverText,
            ]}
          >
            {item.text}
          </Text>

          {/* Footer (time + ticks) */}
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.timeText,
                isCurrentUser
                  ? styles.senderTimeText
                  : styles.receiverTimeText,
              ]}
            >
              {item.createdAt?.toDate
                ? item.createdAt
                    .toDate()
                    .toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                : "--:--"}
            </Text>
            {isCurrentUser && (
              <Text style={styles.readStatus}>{item.read ? "✓✓" : "✓"}</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  messageContainer: {
    flexDirection: "row",
    marginVertical: 4,
  },
  messageContainerCurrentUser: {
    justifyContent: "flex-end",
  },
  messageBubble: {
    maxWidth: "80%",
    borderRadius: 12,
    padding: 10,
  },
  sender: {
    backgroundColor: "#0078fe", // Blue bubble for supervisor
    alignSelf: "flex-end",
  },
  receiver: {
    backgroundColor: "#e5e5ea", // Light grey bubble for student
    alignSelf: "flex-start",
  },
  messageText: {
    fontSize: 16,
  },
  senderText: {
    color: "#fff", // ✅ visible white text on blue
  },
  receiverText: {
    color: "#000", // ✅ visible black text on grey
  },
  replyPreview: {
    borderLeftWidth: 3,
    paddingLeft: 6,
    marginBottom: 4,
  },
  replyPreviewSender: {
    borderLeftColor: "#a0cfff",
  },
  replyPreviewReceiver: {
    borderLeftColor: "#0078fe",
  },
  replyPreviewText: {
    fontSize: 13,
    color: "#555",
  },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  timeText: {
    fontSize: 10,
  },
  senderTimeText: {
    color: "#e1e1e1",
  },
  receiverTimeText: {
    color: "#555",
  },
  readStatus: {
    fontSize: 10,
    marginLeft: 4,
    color: "#e1e1e1",
  },
  pressedMessage: {
    opacity: 0.6,
  },
});

export default MemoizedMessageItem;
