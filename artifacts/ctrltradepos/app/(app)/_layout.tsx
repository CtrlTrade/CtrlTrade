import { Stack } from "expo-router";
import React from "react";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#14181F" } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="sales" />
      <Stack.Screen name="sale" options={{ presentation: "modal" }} />
      <Stack.Screen name="receipt/[id]" options={{ presentation: "modal" }} />
    </Stack>
  );
}
