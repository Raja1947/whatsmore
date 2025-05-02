import {
  Form,
  json,
  useActionData,
  useLoaderData,
  useSubmit,
} from "@remix-run/react";
import { useEffect, useState } from "react";
import { Buffer } from "buffer";
import prisma from "../db.server";
import ImageKit from "imagekit";
import {
  Button,
  Checkbox,
  FormLayout,
  Modal,
  TextField,
} from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

// ======== LOADER ========y
export async function loader() {
  const videos = await prisma.uploadedFile.findMany({
    orderBy: { createdAt: "desc" },
  });
  return json({ videos });
}

// ======== TIMESTAMP HELPER ========
function convertTimestampToSeconds(timestamp) {
  const parts = timestamp.split(":").map(Number);
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

// ======== ACTION ========
export async function action({ request }) {
  try {
    const form = await request.formData();
    const intent = form.get("intent");

    if (intent === "upload") {
      const imagekit = new ImageKit({
        publicKey: "public_9e2hRHDZqguUtp1evFB99eHxA6g=",
        privateKey: "private_fZyyOtu12Sq89lW7VTyCR2EUow8=",
        urlEndpoint: "https://ik.imagekit.io/151189iyo",
      });

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
        data: {
          url: result.url,
        },
      });

      return json({ newVideo });
    }

    if (intent === "save-product") {
      const variantIds = form.getAll("variantId");
      const videoUrls = form.getAll("videoUrl");
      const timestamps = form.getAll("timestamp");
      const handles=form.getAll("handle")

      for (let i = 0; i < variantIds.length; i++) {
        const variantId = variantIds[i];
        const videoUrl = videoUrls[i];
        const timestamp = timestamps[i];
        const handle = handles[i];

        const uploadedFile = await prisma.uploadedFile.findUnique({
          where: { url: videoUrl },

        });
        console.log(uploadedFile,'r')

        if (!uploadedFile) {
          throw new Error(`No video found for URL: ${videoUrl}`);
        }

        await prisma.selectedProduct.create({
          data: {
            variantId,
            handle,
            timestamp: convertTimestampToSeconds(timestamp),
            uploadedFileId: uploadedFile.id,
          },
        });
        await prisma.uploadedFile.update({
          where: { id: uploadedFile.id },
          data: { selected: true },
        });
      }

      return json({ success: true });
    }

    return json({ error: "Invalid intent" }, { status: 400 });
  } catch (err) {
    console.error("Upload error:", err);
    return json({ error: err.message }, { status: 500 });
  }
}

// ======== COMPONENT ========
export default function UploadPage() {
  const { videos } = useLoaderData();
  const actionData = useActionData();
  const app = useAppBridge();
  const submit = useSubmit();

  const [uploadedVideos, setUploadedVideos] = useState(videos || []);
  const [checkedVideos, setCheckedVideos] = useState({});
  const [openModalId, setOpenModalId] = useState(null);
  const [productTimestamps, setProductTimestamps] = useState({});
  const [variantProducts, setVariantProducts] = useState({});
  const [timestampErrors, setTimestampErrors] = useState({});

  useEffect(() => {
    if (actionData?.newVideo) {
      setUploadedVideos((prev) => [...prev, actionData.newVideo]);
    }
  }, [actionData]);

  const toggleCheckbox = (videoId) => {
    setCheckedVideos((prev) => ({
      ...prev,
      [videoId]: !prev[videoId],
    }));
  };

  const handleTimestampChange = (videoId, value) => {
    const regex = /^(\d{1,2}:)?\d{1,2}$/;
    if (value === "") {
      setProductTimestamps((prev) => ({ ...prev, [videoId]: value }));
      setTimestampErrors((prev) => ({ ...prev, [videoId]: "" }));
      return;
    }

    if (!regex.test(value)) {
      setTimestampErrors((prev) => ({
        ...prev,
        [videoId]: "Please enter time as mm:ss or ss",
      }));
      return;
    }

    setTimestampErrors((prev) => ({ ...prev, [videoId]: "" }));
    setProductTimestamps((prev) => ({ ...prev, [videoId]: value }));
  };

  const formatTimestamp = (value) => {
    if (!value) return "00:00";
    const parts = value.split(":");
    if (parts.length === 1) return `00:${parts[0].padStart(2, "0")}`;
    if (parts.length === 2) return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    return value;
  };

  const handleOpenProduct = async (videoId) => {
    const selected = await app.resourcePicker({ type: "product" });
    const variant = selected.selection[0];
    if (!variant) return;
    console.log(selected,'selecteddddddd')

    const productData = {
      id: variant.id,
      title: variant.title,
      image: variant.image?.originalSrc || "https://via.placeholder.com/100",
      timestamp: formatTimestamp(productTimestamps[videoId] || "00:00"),
      handle: variant.handle
    };

    setVariantProducts((prev) => {
      const updated = { ...prev };
      if (!updated[videoId]) updated[videoId] = [];
      if (updated[videoId].length < 5) {
        updated[videoId].push(productData);
      }
      return updated;
    });

    setOpenModalId(null);
  };

  const handleSave = () => {
    const payload = [];

    for (const video of uploadedVideos) {
      const videoId = video.id;
      const videoUrl = video.url;
      const products = variantProducts[videoId] || [];
    

      products.forEach((product) => {
        payload.push({
          variantId: product.id,
          videoUrl: videoUrl,
          timestamp: product.timestamp,
          handle:product.handle
        });
      });
    }

    const productData = new FormData();
    payload.forEach((item) => {
      productData.append("variantId", item.variantId);
      productData.append("videoUrl", item.videoUrl);
      productData.append("timestamp", item.timestamp);
      productData.append("handle", item.handle)
    });
    productData.append("intent", "save-product");

    submit(productData, { method: "post" });
  };

  return (
    <div style={{ padding: "2rem" }}>
      <div style={{ textAlign: "right", marginBottom: "1rem" }}>
        <Button primary onClick={handleSave}>
          Save
        </Button>
      </div>

      <h1>Upload Video</h1>
      <Form method="post" encType="multipart/form-data">
        <input type="file" name="file" accept="video/*" />
        <input type="hidden" name="intent" value="upload" />
        <button type="submit" style={{ marginLeft: "1rem" }}>
          Upload
        </button>
      </Form>

      {uploadedVideos.length > 0 && (
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
            {uploadedVideos.map((video) => (
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
                  checked={!!checkedVideos[video.id]}
                  onChange={() => toggleCheckbox(video.id)}
                />

                {variantProducts[video.id] && (
                  <div style={{ margin: "1rem 0", textAlign: "center" }}>
                    {variantProducts[video.id].map((product, index) => (
                      <div key={index} style={{ marginBottom: "1rem" }}>
                        <img
                          src={product.image}
                          alt={product.title}
                          style={{
                            width: "80px",
                            height: "80px",
                            objectFit: "cover",
                            borderRadius: "8px",
                          }}
                        />
                        <p style={{ marginTop: "0.5rem", fontWeight: "500" }}>
                          {product.title}
                        </p>
                        <p style={{ fontSize: "0.8rem", color: "#666" }}>
                          Timestamp: {product.timestamp}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {checkedVideos[video.id] && (
                  <Button
                    fullWidth
                    onClick={() => setOpenModalId(video.id)}
                    disabled={variantProducts[video.id]?.length >= 5}
                  >
                    Add Product
                  </Button>
                )}

                <Modal
                  open={openModalId === video.id}
                  onClose={() => setOpenModalId(null)}
                  title="Add Product to Video"
                  primaryAction={{
                    content: "Save Product",
                    onAction: () => handleOpenProduct(video.id),
                  }}
                  secondaryActions={[
                    {
                      content: "Cancel",
                      onAction: () => setOpenModalId(null),
                    },
                  ]}
                >
                  <Modal.Section>
                    <FormLayout>
                      <TextField
                        label="Timestamp (mm:ss or ss)"
                        value={productTimestamps[video.id] || ""}
                        onChange={(value) =>
                          handleTimestampChange(video.id, value)
                        }
                        error={timestampErrors[video.id]}
                        placeholder="mm:ss or ss"
                        autoComplete="off"
                      />
                    </FormLayout>
                  </Modal.Section>
                </Modal>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
