import { connection } from "next/server";
import { HomeClient } from "./home-client";

export default async function Home() {
  await connection();
  return <HomeClient />;
}
