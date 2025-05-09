import {
  json,
  useActionData,
  useLoaderData,
  useSubmit,
} from "@remix-run/react";
import { useEffect, useState } from "react";
import prisma from "../db.server";
import { Button, Checkbox, Modal } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";

// ======== LOADER ========
export async function loader() {
  const videos = await prisma.uploadedFile.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      productLinks: {
        orderBy: { timestamp: "asc" },
      },
    },
  });
  return json({ videos });
}

// ======== TIMESTAMP HELPER ========
function convertTimestampToSeconds(timestamp) {
  if (!timestamp) return 0;
  if (typeof timestamp === "number") return timestamp;

  const parts = timestamp.toString().split(":").map(Number);
  if (parts.some(isNaN)) return 0;

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// ======== ACTION ========
export async function action({ request }) {
  try {
    const form = await request.formData();
    const intent = form.get("intent");

    if (intent === "save-product") {
      const videoProducts = JSON.parse(form.get("videoProducts"));

      for (const { videoUrl, products } of videoProducts) {
        const uploadedFile = await prisma.uploadedFile.findUnique({
          where: { url: videoUrl },
          include: { productLinks: true },
        });

        if (!uploadedFile) {
          throw new Error(`No video found for URL: ${videoUrl}`);
        }

        // Add new products (up to 2)
        for (let i = 0; i < Math.min(products.length, 2); i++) {
          const product = products[i];
          await prisma.selectedProduct.create({
            data: {
              variantId: product.variantId,
              handle: product.handle,
              timestamp: convertTimestampToSeconds(product.timestamp),
              uploadedFileId: uploadedFile.id,
            },
          });
        }

        await prisma.uploadedFile.update({
          where: { id: uploadedFile.id },
          data: { selected: true },
        });
      }

      return json({ success: true });
    }

    if (intent === "delete-product") {
      const productId = Number(form.get("productId"));
      await prisma.selectedProduct.delete({
        where: { id: productId },
      });
      return json({ success: true });
    }

    return json({ error: "Invalid intent" }, { status: 400 });
  } catch (err) {
    console.error("Action error:", err);
    return json({ error: err.message }, { status: 500 });
  }
}

// ======== COMPONENT ========
export default function VideosPage() {
  const { videos } = useLoaderData();
  const actionData = useActionData();
  const app = useAppBridge();
  const submit = useSubmit();

  const [checkedVideos, setCheckedVideos] = useState({});
  const [openModalId, setOpenModalId] = useState(null);
  const [productTimestamps, setProductTimestamps] = useState({});
  const [localProducts, setLocalProducts] = useState({});
  const [timestampErrors, setTimestampErrors] = useState({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [hasUnsavedProducts, setHasUnsavedProducts] = useState({});
  const [savingVideoId, setSavingVideoId] = useState(null);

  useEffect(() => {
    if (actionData?.success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  }, [actionData]);

  function formatTimestamp(value) {
    if (!value) return "00:00";
    const numValue = typeof value === "number" ? value.toString() : value;
    const parts = numValue.split(":");
    if (parts.length === 1) return `00:${parts[0].padStart(2, "0")}`;
    if (parts.length === 2)
      return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
    return value;
  }

  const toggleCheckbox = (videoId) => {
    setCheckedVideos((prev) => ({
      ...prev,
      [videoId]: !prev[videoId],
    }));
  };

  const handleTimestampChange = (videoId, value) => {
    const video = videos.find((v) => v.id === videoId);
    const videoDuration = video?.duration || 0;

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

    const enteredSeconds = convertTimestampToSeconds(value);

    if (enteredSeconds > videoDuration) {
      setTimestampErrors((prev) => ({
        ...prev,
        [videoId]: `Timestamp cannot exceed video duration (${formatDuration(videoDuration)})`,
      }));
      return;
    }

    setTimestampErrors((prev) => ({ ...prev, [videoId]: "" }));
    setProductTimestamps((prev) => ({ ...prev, [videoId]: value }));
  };

  const handleOpenProduct = async (videoId) => {
    const video = videos.find((v) => v.id === videoId);

    const dbProductCount = video?.productLinks?.length || 0;
    const localProductCount = localProducts[videoId]?.length || 0;
    const totalProducts = dbProductCount + localProductCount;

    if (totalProducts >= 2) {
      alert("This video already has the maximum of 2 products");
      setOpenModalId(null);
      return;
    }

    if (timestampErrors[videoId]) {
      alert("Please fix the timestamp error before adding a product");
      return;
    }

    const selected = await app.resourcePicker({ type: "product" });
    if (!selected || !selected.selection || selected.selection.length === 0)
      return;
    const variant = selected.selection[0];

    const productData = {
      id: variant.id,
      title: variant.title,
      image: variant.image?.originalSrc || "https://via.placeholder.com/100",
      timestamp: formatTimestamp(productTimestamps[videoId] || "00:00"),
      handle: variant.handle,
    };

    setLocalProducts((prev) => {
      const updated = { ...prev };
      if (!updated[videoId]) updated[videoId] = [];
      updated[videoId].push(productData);
      setHasUnsavedProducts(prev => ({ ...prev, [videoId]: true }));
      return updated;
    });

    // Clear the timestamp input after adding product
    setProductTimestamps(prev => ({ ...prev, [videoId]: "" }));
    setOpenModalId(null);
  };

  const handleRemoveProduct = (videoId, index) => {
    setLocalProducts((prev) => {
      const updated = { ...prev };
      if (updated[videoId]) {
        updated[videoId] = updated[videoId].filter((_, i) => i !== index);
        if (updated[videoId].length === 0) {
          delete updated[videoId];
          setHasUnsavedProducts(prev => ({ ...prev, [videoId]: false }));
        }
      }
      return updated;
    });
  };

  const handleDeleteProduct = async (productId, videoId) => {
    const formData = new FormData();
    formData.append("intent", "delete-product");
    formData.append("productId", productId);

    await submit(formData, { method: "post" });
    setDeleteConfirm(null);
  };

  const handleSaveVideo = async (videoId) => {
    const video = videos.find(v => v.id === videoId);
    if (!video || !localProducts[videoId]) return;

    setSavingVideoId(videoId);

    const videoProducts = [{
      videoUrl: video.url,
      products: localProducts[videoId].map(product => ({
        variantId: product.id,
        timestamp: product.timestamp,
        handle: product.handle,
      })),
    }];

    const formData = new FormData();
    formData.append("intent", "save-product");
    formData.append("videoProducts", JSON.stringify(videoProducts));

    await submit(formData, { method: "post" });
    
    // Clear local state for this video
    setLocalProducts(prev => {
      const updated = { ...prev };
      delete updated[videoId];
      return updated;
    });
    setHasUnsavedProducts(prev => ({ ...prev, [videoId]: false }));
    setCheckedVideos(prev => ({ ...prev, [videoId]: false }));
    setSavingVideoId(null);
  };

  return (
    <div
      style={{
        padding: "2rem",
        maxWidth: "1100px",
        margin: "0 auto",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Header Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          borderBottom: "1px solid #e2e8f0",
          paddingBottom: "1.5rem",
        }}
      >
        <h1
          style={{
            fontSize: "20px",
            fontWeight: "600",
            color: "#1e293b",
            margin: 0,
          }}
        >
          Video Management
        </h1>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div
          style={{
            backgroundColor: "#f0fdf4",
            color: "#166534",
            padding: "1rem",
            borderRadius: "8px",
            marginBottom: "2rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            border: "1px solid #bbf7d0",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#166534"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          Products saved successfully!
        </div>
      )}

      {/* Uploaded Videos Section */}
      {videos.length > 0 && (
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "2rem",
            border: "1px solid lightgrey",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "2rem",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "500",
                color: "#1e293b",
                margin: 0,
              }}
            >
              Uploaded Videos
            </h2>
            <p
              style={{
                color: "#64748b",
                fontSize: "0.9375rem",
                margin: 0,
              }}
            >
              {videos.length} video
              {videos.length !== 1 ? "s" : ""}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {videos.map((video) => {
              const dbProducts = video.productLinks || [];
              const currentLocalProducts = localProducts[video.id] || [];
              const allProducts = [...dbProducts, ...currentLocalProducts];
              const totalProducts = allProducts.length;

              return (
                <div
                  key={video.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    transition: "all 0.2s ease",
                    ":hover": {
                      transform: "translateY(-2px)",
                      boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                    },
                  }}
                >
                  {/* Video Player */}
                  <div style={{ position: "relative" }}>
                    <video
                      controls
                      style={{
                        width: "100%",
                        height: "300px",
                        objectFit: "cover",
                        backgroundColor: "#f1f5f9",
                      }}
                    >
                      <source src={video.url} type="video/mp4" />
                    </video>
                  </div>

                  {/* Video Content */}
                  <div style={{ padding: "1.25rem" }}>
                    {/* Selection Toggle */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "1rem",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <Checkbox
                          checked={!!checkedVideos[video.id]}
                          onChange={() => toggleCheckbox(video.id)}
                          style={{
                            width: "18px",
                            height: "18px",
                            accentColor: "#4f46e5",
                            cursor: "pointer",
                          }}
                        />
                        <span
                          style={{
                            fontWeight: "500",
                            color: "#1e293b",
                          }}
                        >
                          Select Products
                        </span>
                      </label>

                      {checkedVideos[video.id] && (
                        <button
                          onClick={() => setOpenModalId(video.id)}
                          disabled={totalProducts >= 2}
                          style={{
                            backgroundColor:
                              totalProducts >= 2 ? "#e2e8f0" : "#e2e8f0",
                            color: totalProducts >= 2 ? "#64748b" : "black",
                            border: "none",
                            borderRadius: "6px",
                            padding: "0.375rem 0.75rem",
                            fontSize: "0.8125rem",
                            fontWeight: "500",
                            cursor:
                              totalProducts >= 2 ? "not-allowed" : "pointer",
                            transition: "all 0.2s ease",
                          }}
                        >
                          {totalProducts >= 2 ? "Max reached" : "+ Add Product"}
                        </button>
                      )}
                    </div>

                    {/* Products List */}
                    {totalProducts > 0 ? (
                      <div
                        style={{
                          borderTop: "1px solid #e2e8f0",
                          paddingTop: "1rem",
                        }}
                      >
                        <h4
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: "#64748b",
                            marginBottom: "0.75rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                          }}
                        >
                          Linked Products ({totalProducts})
                        </h4>

                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem",
                          }}
                        >
                          {allProducts.map((product, index) => {
                            const isLocalProduct = index >= dbProducts.length;
                            return (
                              <div
                                key={index}
                                style={{
                                  position: "relative",
                                  display: "flex",
                                  gap: "0.75rem",
                                  alignItems: "center",
                                  padding: "0.75rem",
                                  borderRadius: "8px",
                                  backgroundColor: "#f8fafc",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                <img
                                  src={
                                    isLocalProduct
                                      ? product.image
                                      : "https://via.placeholder.com/100"
                                  }
                                  alt={
                                    isLocalProduct
                                      ? product.title
                                      : product.handle
                                  }
                                  style={{
                                    width: "50px",
                                    height: "50px",
                                    objectFit: "cover",
                                    borderRadius: "6px",
                                    flexShrink: 0,
                                  }}
                                />
                                <div style={{ flex: 1 }}>
                                  <p
                                    style={{
                                      fontWeight: "500",
                                      margin: 0,
                                      fontSize: "0.875rem",
                                    }}
                                  >
                                    {isLocalProduct
                                      ? product.title
                                      : product.handle}
                                  </p>
                                  <p
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#64748b",
                                      margin: "0.25rem 0 0",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.25rem",
                                    }}
                                  >
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="#64748b"
                                    >
                                      <circle cx="12" cy="12" r="10"></circle>
                                      <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                    {formatTimestamp(product.timestamp)}
                                  </p>
                                </div>
                                <button
                                  onClick={() =>
                                    isLocalProduct
                                      ? handleRemoveProduct(
                                          video.id,
                                          index - dbProducts.length,
                                        )
                                      : setDeleteConfirm({
                                          productId: product.id,
                                          videoId: video.id,
                                        })
                                  }
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#ef4444",
                                    cursor: "pointer",
                                    padding: "0.25rem",
                                    borderRadius: "4px",
                                    ":hover": {
                                      backgroundColor: "#fee2e2",
                                    },
                                  }}
                                >
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                  >
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  </svg>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "1rem",
                          backgroundColor: "#f8fafc",
                          borderRadius: "8px",
                          marginTop: "1rem",
                        }}
                      >
                        <p
                          style={{
                            color: "#64748b",
                            margin: 0,
                            fontSize: "0.875rem",
                          }}
                        >
                          No products linked to this video
                        </p>
                      </div>
                    )}

                    {/* Save Products Button */}
                    {hasUnsavedProducts[video.id] && (
                      <div style={{ marginTop: "1rem" }}>
                        <Button
                          primary
                          fullWidth
                          loading={savingVideoId === video.id}
                          onClick={() => handleSaveVideo(video.id)}
                        >
                          Save Products
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modals */}
      {videos.map((video) => (
        <div key={video.id}>
          {/* Add Product Modal */}
          <Modal
            open={openModalId === video.id}
            onClose={() => {
              setOpenModalId(null);
              // Clear timestamp when closing modal
              setProductTimestamps(prev => ({ ...prev, [video.id]: "" }));
            }}
            style={{
              maxWidth: "500px",
              borderRadius: "12px",
              border: "none",
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ padding: "1.5rem" }}>
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  color: "#1e293b",
                  marginBottom: "1.5rem",
                }}
              >
                Add Product to Video
              </h3>

              <div style={{ marginBottom: "1.5rem" }}>
                <p
                  style={{
                    color: "#64748b",
                    marginBottom: "0.5rem",
                    fontSize: "0.875rem",
                  }}
                >
                  Video duration:{" "}
                  <strong>{formatDuration(video.duration)}</strong>
                </p>

                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: "500",
                    color: "#334155",
                    fontSize: "0.875rem",
                  }}
                >
                  Timestamp
                </label>
                <input
                  value={productTimestamps[video.id] || ""}
                  onChange={(e) =>
                    handleTimestampChange(video.id, e.target.value)
                  }
                  placeholder="mm:ss or ss"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: `1px solid ${timestampErrors[video.id] ? "#ef4444" : "#e2e8f0"}`,
                    borderRadius: "8px",
                    fontSize: "0.9375rem",
                    ":focus": {
                      outline: "none",
                      boxShadow: "0 0 0 3px rgba(129, 140, 248, 0.2)",
                    },
                  }}
                />
                {timestampErrors[video.id] && (
                  <p
                    style={{
                      color: "#ef4444",
                      fontSize: "0.75rem",
                      marginTop: "0.25rem",
                    }}
                  >
                    {timestampErrors[video.id]}
                  </p>
                )}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.75rem",
                }}
              >
                <button
                  onClick={() => {
                    setOpenModalId(null);
                    setProductTimestamps(prev => ({ ...prev, [video.id]: "" }));
                  }}
                  style={{
                    padding: "0.4rem 1rem",
                    backgroundColor: "transparent",
                    color: "black",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleOpenProduct(video.id)}
                  disabled={!!timestampErrors[video.id]}
                  style={{
                    padding: "0.4rem 1rem",
                    backgroundColor: timestampErrors[video.id] ? "#e2e8f0" : "#e2e8f0",
                    color: timestampErrors[video.id] ? "#64748b" : "black",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "500",
                    cursor: timestampErrors[video.id] ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  Save Product
                </button>
              </div>
            </div>
          </Modal>

          {/* Delete Confirmation Modal */}
          <Modal
            open={deleteConfirm?.videoId === video.id}
            onClose={() => setDeleteConfirm(null)}
            style={{
              maxWidth: "400px",
              borderRadius: "12px",
              border: "none",
              boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            }}
          >
            <div style={{ padding: "2.5rem", textAlign: "center" }}>
              <h3
                style={{
                  fontSize: "1.25rem",
                  fontWeight: "600",
                  color: "#1e293b",
                  marginBottom: "0.5rem",
                }}
              >
                Confirm Deletion
              </h3>
              <p
                style={{
                  color: "#64748b",
                  marginBottom: "1.5rem",
                }}
              >
                Are you sure you want to delete this product permanently?
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: "0.75rem",
                }}
              >
                <button
                  onClick={() => setDeleteConfirm(null)}
                  style={{
                    padding: "0.4rem 1rem",
                    backgroundColor: "transparent",
                    color: "#64748b",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    ":hover": {
                      backgroundColor: "#f1f5f9",
                    },
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleDeleteProduct(deleteConfirm.productId, video.id)
                  }
                  style={{
                    padding: "0.4rem 1rem",
                    backgroundColor: "#ef4444",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    ":hover": {
                      backgroundColor: "#dc2626",
                    },
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </Modal>
        </div>
      ))}
    </div>
  );
}