import React, { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { CustomerAPI } from "@cargoone/core";
import { Body, CARGO, H1, Input, Label, PrimaryButton, Screen } from "../ui";
import type { RootStackParamList } from "../App";

type P = NativeStackScreenProps<RootStackParamList, "Review">;

export function ReviewScreen({ route, navigation }: P) {
  const { bookingId } = route.params;
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await CustomerAPI.submitReview(bookingId, rating, comment);
      Alert.alert("Thanks!", "Your review has been posted.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Could not submit", e?.message || "");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H1>How was your driver?</H1>
      <Body muted style={{ marginTop: 6, marginBottom: 20 }}>
        Reviews help other customers pick with confidence.
      </Body>
      <Label>Rating</Label>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setRating(n)} testID={`review-star-${n}`}>
            <Text style={{ fontSize: 32, color: n <= rating ? "#FF6A00" : CARGO.hairline }}>★</Text>
          </Pressable>
        ))}
      </View>
      <Label>Comment (optional)</Label>
      <Input value={comment} onChangeText={setComment} multiline testID="review-comment" style={{ height: 100 }} />
      <PrimaryButton title="Post review" onPress={submit} loading={busy} testID="review-submit" />
    </Screen>
  );
}
