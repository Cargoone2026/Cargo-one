/**
 * ReviewScreen — post-delivery driver rating.
 */
import React, { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Star } from "lucide-react-native";
import { CustomerAPI } from "@cargoone/core";
import { colors, radius, typography } from "../theme";
import { Input, Label, Page, PageHeader, PrimaryButton } from "../ui";
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
    <Page testID="review-screen">
      <ScrollView>
        <PageHeader title="How was your driver?" subtitle="Reviews help other customers pick with confidence." />
        <View style={{ paddingHorizontal: 16, paddingBottom: 32, gap: 12 }}>
          <Label>Rating</Label>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} testID={`review-star-${n}`} hitSlop={8}>
                <Star size={36} color={n <= rating ? colors.accent : colors.border} fill={n <= rating ? colors.accent : "transparent"} />
              </Pressable>
            ))}
          </View>
          <Label>Comment (optional)</Label>
          <Input
            value={comment}
            onChangeText={setComment}
            multiline
            style={{ height: 120, textAlignVertical: "top" }}
            testID="review-comment"
          />
          <PrimaryButton title="Post review" onPress={submit} loading={busy} testID="review-submit" />
        </View>
      </ScrollView>
    </Page>
  );
}
