import { json } from "@remix-run/node";
import prisma from "../db.server";

export async function loader({ request }) {
  const origin = request.headers.get("origin") || "*";

  const videos = await prisma.uploadedFile.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      productLinks: true,
    },
  });
  console.log(videos, "videooossssss");

  return json(
    { data: videos },
    {
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Accept",
        "Access-Control-Allow-Credentials": "true",
      },
    },
  );
}

// Optional: handle preflight
export async function options({ request }) {
  const origin = request.headers.get("origin") || "*";

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Access-Control-Allow-Credentials": "true",
    },
  });
}
