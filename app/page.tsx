import { connection } from "next/server";
import { HomeClient } from "../components/HomeClient";

export default async function Home() {
  await connection();
  return <HomeClient />;
}
