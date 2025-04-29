import { Form, json, useActionData, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { Buffer } from "buffer";
import ImageKit from "imagekit";
import prisma from "../db.server";

import { Button, Checkbox, FormLayout, TextField } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

export async function loader() {
  const videos = await prisma.uploadedFile.findMany({
    orderBy: { createdAt: "desc" },
  });
  return json({ videos });
}

export async function action({ request }) {
  try {
    const imagekit = new ImageKit({
      publicKey: "public_OxbyDHLl7mAo10apOvR70oHiGsU=",
      privateKey: "private_u+N6B/ftta2yH17yHzryN2/qfDQ=",
      urlEndpoint: "https://ik.imagekit.io/2d17j7ktvr",
    });

    const form = await request.formData();
    const file = form.get("file");

    if (!file || typeof file === "string") {
      throw new Error("No valid file uploaded");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await imagekit.upload({
      file: buffer,
      fileName: file.name,
    });

    const newVideo = await prisma.uploadedFile.create({
      data: { url: result.url },
    });

    return json({ newVideo });
  } catch (err) {
    console.error("Upload error:", err);
    return json({ error: err.message }, { status: 500 });
  }
}

export default function UploadPage() {
  const { videos } = useLoaderData();
  const actionData = useActionData();

  const [isChecked, setIsChecked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [productName, setProductName] = useState("");
  const [variantProductId, setVariantProductId] = useState("");
  const app = useAppBridge();

  const handleOpenProduct = async () => {
    const selected = await app.resourcePicker({ type: "variant" });
    const variantId = selected.selection[0].id;
    setVariantProductId(variantId);
  };

  const allVideos = actionData?.newVideo
    ? [actionData.newVideo, ...videos]
    : videos;

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Upload Video</h1>
      <Form method="post" encType="multipart/form-data">
        <input type="file" name="file" accept="video/*" />
        <button type="submit" style={{ marginLeft: "1rem" }}>
          Upload
        </button>
      </Form>

      {allVideos.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <h2>All Uploaded Videos</h2>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "2rem",
              marginTop: "1rem",
            }}
          >
            {allVideos.map((video) => (
              <div
                key={video.id}
                style={{
                  flex: "1 1 300px",
                  maxWidth: "320px",
                  border: "1px solid #ddd",
                  borderRadius: "12px",
                  padding: "1rem",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  backgroundColor: "#fff",
                }}
              >
                <video width="100%" controls style={{ borderRadius: "8px" }}>
                  <source src={video.url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>

                <Checkbox
                  label="Select"
                  checked={isChecked}
                  onChange={() => setIsChecked(!isChecked)}
                />

                {isChecked && (
                  <Button fullWidth onClick={() => setShowForm(true)}>
                    Add Product
                  </Button>
                )}

                {showForm && (
                  <div style={{ marginTop: "1rem" }}>
                    <Form method="post">
                      <FormLayout>
                        <TextField
                          label="Time Stamp"
                          value={productName}
                          onChange={(value) => setProductName(value)}
                          required
                        />
                        <Button
                          primary
                          onClick={handleOpenProduct}
                          style={{ marginTop: "1rem" }}
                        >
                          Save Product
                        </Button>
                      </FormLayout>
                    </Form>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
