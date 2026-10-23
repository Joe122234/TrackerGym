import type { Metadata } from "next";
import { BodyClient } from "./body-client";

export const metadata: Metadata = {
  title: "Body",
  description: "Body weight and measurement tracking with real recorded entries.",
};

export default function BodyPage() {
  return <BodyClient />;
}
